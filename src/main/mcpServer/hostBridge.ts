import type { BrowserWindow } from 'electron';
import { logVerbose } from '#/main/logger';

/**
 * Maximum wait for the renderer to execute an MCP server tool call.
 */
const MCP_SERVER_TOOL_TIMEOUT_MS = 60_000;

interface PendingMcpServerToolInvoke {
  name: string;
  resolve: (value: string) => void;
  reject: (reason?: unknown) => void;
  timeout: ReturnType<typeof setTimeout>;
}

interface McpServerToolInvokeMessage {
  requestId: number;
  name: string;
  args: unknown;
}

interface McpServerToolCompleteMessage {
  requestId: number;
  ok: boolean;
  result?: string;
  error?: string;
}

/**
 * Routes MCP server tool calls through the host renderer so Harbor AI tools can reuse Redux state.
 */
export class McpToolBridge {
  readonly #pending = new Map<number, PendingMcpServerToolInvoke>();
  #nextRequestId = 1;
  #mainWindow: (() => BrowserWindow | null) | null = null;

  /**
   * Supplies the main application window used to forward tool invocations.
   *
   * @param getter - Returns the current main window or null when destroyed.
   */
  setMainWindow(getter: () => BrowserWindow | null): void {
    this.#mainWindow = getter;
  }

  /**
   * Executes a Harbor AI tool on behalf of an external MCP client.
   *
   * @param name - Harbor AI tool name.
   * @param args - Parsed tool arguments.
   */
  invokeTool(name: string, args: unknown): Promise<string> {
    const window = this.#mainWindow?.();
    if (!window || window.isDestroyed()) {
      return Promise.reject(new Error('HarborClient must be open to execute MCP tools.'));
    }

    const requestId = this.#nextRequestId++;
    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#pending.delete(requestId);
        reject(new Error(`MCP tool invocation timed out: ${name}`));
      }, MCP_SERVER_TOOL_TIMEOUT_MS);

      this.#pending.set(requestId, { name, resolve, reject, timeout });
      logVerbose('mcp:server:tool', { name, requestId });
      window.webContents.send('mcp:serverToolInvoke', {
        requestId,
        name,
        args
      } satisfies McpServerToolInvokeMessage);
    });
  }

  /**
   * Resolves or rejects a pending MCP server tool invoke when the renderer replies.
   *
   * @param message - Completion payload from the renderer preload bridge.
   */
  completeToolInvoke(message: McpServerToolCompleteMessage): void {
    const pending = this.#pending.get(message.requestId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.#pending.delete(message.requestId);

    logVerbose('mcp:server:tool-complete', {
      requestId: message.requestId,
      name: pending.name,
      ok: message.ok,
      ...(message.ok ? {} : { error: message.error ?? 'MCP tool invocation failed.' })
    });

    if (message.ok) {
      pending.resolve(message.result ?? JSON.stringify({ error: 'Empty tool result.' }));
      return;
    }

    pending.reject(new Error(message.error ?? 'MCP tool invocation failed.'));
  }

  /**
   * Clears pending invocations during shutdown.
   */
  dispose(): void {
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('MCP server shutting down.'));
    }
    this.#pending.clear();
  }
}

let bridgeInstance: McpToolBridge | null = null;

/**
 * Returns the singleton MCP tool bridge instance.
 */
export function getMcpToolBridge(): McpToolBridge {
  if (!bridgeInstance) {
    bridgeInstance = new McpToolBridge();
  }
  return bridgeInstance;
}

/**
 * Disposes the MCP tool bridge singleton.
 */
export function disposeMcpToolBridge(): void {
  bridgeInstance?.dispose();
  bridgeInstance = null;
}
