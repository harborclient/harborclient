import type { BrowserWindow } from 'electron';
import { logVerbose } from '#/main/logger';
import type { ScriptWebpageRequest } from '#/main/scripting/scriptApi';

/**
 * Maximum wait for the renderer to complete a script webpage operation.
 */
const SCRIPT_WEBPAGE_TIMEOUT_MS = 60_000;

interface PendingScriptWebpageInvoke {
  op: ScriptWebpageRequest['op'];
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timeout: ReturnType<typeof setTimeout>;
}

interface ScriptWebpageInvokeMessage {
  requestId: number;
  req: ScriptWebpageRequest;
}

interface ScriptWebpageCompleteMessage {
  requestId: number;
  ok: boolean;
  result?: unknown;
  error?: string;
}

/**
 * Routes hc.webpage bridge calls through the host renderer so Redux tab state stays authoritative.
 */
export class ScriptWebpageBridge {
  readonly #pending = new Map<number, PendingScriptWebpageInvoke>();
  #nextRequestId = 1;
  #mainWindow: (() => BrowserWindow | null) | null = null;

  /**
   * Supplies the main application window used to forward webpage operations.
   *
   * @param getter - Returns the current main window or null when destroyed.
   */
  setMainWindow(getter: () => BrowserWindow | null): void {
    this.#mainWindow = getter;
  }

  /**
   * Executes a webpage operation in the renderer and returns its result.
   *
   * @param req - Webpage operation from the script sandbox.
   * @returns Operation result from the renderer session helpers.
   */
  invoke(req: ScriptWebpageRequest): Promise<unknown> {
    const window = this.#mainWindow?.();
    if (!window || window.isDestroyed()) {
      return Promise.reject(new Error('HarborClient must be open to use hc.webpage.'));
    }

    const requestId = this.#nextRequestId++;
    return new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#pending.delete(requestId);
        reject(new Error(`Script webpage invocation timed out: ${req.op}`));
      }, SCRIPT_WEBPAGE_TIMEOUT_MS);

      this.#pending.set(requestId, { op: req.op, resolve, reject, timeout });
      logVerbose('scripts:webpage', { op: req.op, requestId });
      window.webContents.send('scripts:webpageInvoke', {
        requestId,
        req
      } satisfies ScriptWebpageInvokeMessage);
    });
  }

  /**
   * Resolves or rejects a pending webpage invoke when the renderer replies.
   *
   * @param message - Completion payload from the renderer preload bridge.
   */
  complete(message: ScriptWebpageCompleteMessage): void {
    const pending = this.#pending.get(message.requestId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.#pending.delete(message.requestId);

    logVerbose('scripts:webpage-complete', {
      requestId: message.requestId,
      op: pending.op,
      ok: message.ok,
      ...(message.ok ? {} : { error: message.error ?? 'Script webpage invocation failed.' })
    });

    if (message.ok) {
      pending.resolve(message.result);
      return;
    }

    pending.reject(new Error(message.error ?? 'Script webpage invocation failed.'));
  }

  /**
   * Clears pending invocations during shutdown.
   */
  dispose(): void {
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Script webpage bridge shutting down.'));
    }
    this.#pending.clear();
  }
}

let bridgeInstance: ScriptWebpageBridge | null = null;

/**
 * Returns the singleton script webpage bridge instance.
 *
 * @returns Shared {@link ScriptWebpageBridge}.
 */
export function getScriptWebpageBridge(): ScriptWebpageBridge {
  if (!bridgeInstance) {
    bridgeInstance = new ScriptWebpageBridge();
  }
  return bridgeInstance;
}

/**
 * Disposes the script webpage bridge singleton.
 */
export function disposeScriptWebpageBridge(): void {
  bridgeInstance?.dispose();
  bridgeInstance = null;
}
