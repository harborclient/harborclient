import type { BrowserWindow } from 'electron';
import { logVerbose } from '#/main/logger';
import type { ScriptLivePageRequest } from '#/main/scripting/scriptApi';

/**
 * Maximum wait for the renderer to complete a script live-page operation.
 */
const SCRIPT_LIVE_PAGE_TIMEOUT_MS = 60_000;

interface PendingScriptLivePageInvoke {
  op: ScriptLivePageRequest['op'];
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timeout: ReturnType<typeof setTimeout>;
}

interface ScriptLivePageInvokeMessage {
  requestId: number;
  req: ScriptLivePageRequest;
}

interface ScriptLivePageCompleteMessage {
  requestId: number;
  ok: boolean;
  result?: unknown;
  error?: string;
}

/**
 * Routes hc.livePage bridge calls through the host renderer so Redux tab state stays authoritative.
 */
export class ScriptLivePageBridge {
  readonly #pending = new Map<number, PendingScriptLivePageInvoke>();
  #nextRequestId = 1;
  #mainWindow: (() => BrowserWindow | null) | null = null;

  /**
   * Supplies the main application window used to forward live-page operations.
   *
   * @param getter - Returns the current main window or null when destroyed.
   */
  setMainWindow(getter: () => BrowserWindow | null): void {
    this.#mainWindow = getter;
  }

  /**
   * Executes a live-page operation in the renderer and returns its result.
   *
   * @param req - Live-page operation from the script sandbox.
   * @returns Operation result from the renderer session helpers.
   */
  invoke(req: ScriptLivePageRequest): Promise<unknown> {
    const window = this.#mainWindow?.();
    if (!window || window.isDestroyed()) {
      return Promise.reject(new Error('HarborClient must be open to use hc.livePage.'));
    }

    const requestId = this.#nextRequestId++;
    return new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#pending.delete(requestId);
        reject(new Error(`Script live page invocation timed out: ${req.op}`));
      }, SCRIPT_LIVE_PAGE_TIMEOUT_MS);

      this.#pending.set(requestId, { op: req.op, resolve, reject, timeout });
      logVerbose('scripts:livePage', { op: req.op, requestId });
      window.webContents.send('scripts:livePageInvoke', {
        requestId,
        req
      } satisfies ScriptLivePageInvokeMessage);
    });
  }

  /**
   * Resolves or rejects a pending live-page invoke when the renderer replies.
   *
   * @param message - Completion payload from the renderer preload bridge.
   */
  complete(message: ScriptLivePageCompleteMessage): void {
    const pending = this.#pending.get(message.requestId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.#pending.delete(message.requestId);

    logVerbose('scripts:livePage-complete', {
      requestId: message.requestId,
      op: pending.op,
      ok: message.ok,
      ...(message.ok ? {} : { error: message.error ?? 'Script live page invocation failed.' })
    });

    if (message.ok) {
      pending.resolve(message.result);
      return;
    }

    pending.reject(new Error(message.error ?? 'Script live page invocation failed.'));
  }

  /**
   * Clears pending invocations during shutdown.
   */
  dispose(): void {
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Script live page bridge shutting down.'));
    }
    this.#pending.clear();
  }
}

let bridgeInstance: ScriptLivePageBridge | null = null;

/**
 * Returns the singleton script live-page bridge instance.
 *
 * @returns Shared {@link ScriptLivePageBridge}.
 */
export function getScriptLivePageBridge(): ScriptLivePageBridge {
  if (!bridgeInstance) {
    bridgeInstance = new ScriptLivePageBridge();
  }
  return bridgeInstance;
}

/**
 * Disposes the script live-page bridge singleton.
 */
export function disposeScriptLivePageBridge(): void {
  bridgeInstance?.dispose();
  bridgeInstance = null;
}
