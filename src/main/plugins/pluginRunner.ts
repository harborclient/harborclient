import 'ses';
import type {
  PluginHttpRequest,
  PluginHttpResponse,
  PluginPermission
} from '#/shared/plugin/types';

lockdown();

interface ActivateMessage {
  type: 'activate';
  id: number;
  pluginId: string;
  source: string;
  permissions: PluginPermission[];
}

interface DeactivateMessage {
  type: 'deactivate';
  id: number;
  pluginId: string;
}

interface BeforeSendMessage {
  type: 'beforeSend';
  id: number;
  request: PluginHttpRequest;
}

interface AfterSendMessage {
  type: 'afterSend';
  id: number;
  request: PluginHttpRequest;
  response: PluginHttpResponse;
}

interface InvokeMessage {
  type: 'invoke';
  id: number;
  pluginId: string;
  channel: string;
  args: unknown[];
}

type IncomingMessage =
  | ActivateMessage
  | DeactivateMessage
  | BeforeSendMessage
  | AfterSendMessage
  | InvokeMessage;

interface SuccessReply {
  id: number;
  ok: true;
  result?: unknown;
}

interface ErrorReply {
  id: number;
  ok: false;
  error: string;
}

interface PluginState {
  pluginId: string;
  permissions: PluginPermission[];
  beforeSend: Array<(request: PluginHttpRequest) => void | Promise<void>>;
  afterSend: Array<
    (request: PluginHttpRequest, response: PluginHttpResponse) => void | Promise<void>
  >;
  ipcHandlers: Map<string, (...args: unknown[]) => unknown>;
  subscriptions: Array<{ dispose: () => void }>;
  /** Optional deactivate export captured from the activation compartment. */
  deactivate?: () => void;
}

const plugins = new Map<string, PluginState>();

/**
 * Builds the hc API exposed to main-process plugin entries.
 *
 * @param state - Mutable plugin runtime state.
 */
function createMainPluginContext(state: PluginState): Record<string, unknown> {
  const subscriptions: Array<{ dispose: () => void }> = [];
  state.subscriptions = subscriptions;

  const assertPermission = (permission: PluginPermission): void => {
    if (!state.permissions.includes(permission)) {
      throw new Error(`Plugin ${state.pluginId} lacks permission: ${permission}`);
    }
  };

  return {
    subscriptions,
    storage: {
      get: async () => undefined,
      set: async () => undefined
    },
    http: {
      onBeforeSend: (handler: (request: PluginHttpRequest) => void | Promise<void>) => {
        assertPermission('http');
        state.beforeSend.push(handler);
        const disposable = {
          dispose: () => {
            const index = state.beforeSend.indexOf(handler);
            if (index >= 0) {
              state.beforeSend.splice(index, 1);
            }
          }
        };
        subscriptions.push(disposable);
        return disposable;
      },
      onAfterSend: (
        handler: (request: PluginHttpRequest, response: PluginHttpResponse) => void | Promise<void>
      ) => {
        assertPermission('http');
        state.afterSend.push(handler);
        const disposable = {
          dispose: () => {
            const index = state.afterSend.indexOf(handler);
            if (index >= 0) {
              state.afterSend.splice(index, 1);
            }
          }
        };
        subscriptions.push(disposable);
        return disposable;
      }
    },
    ipc: {
      handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
        assertPermission('ipc');
        state.ipcHandlers.set(channel, handler);
        const disposable = {
          dispose: () => {
            state.ipcHandlers.delete(channel);
          }
        };
        subscriptions.push(disposable);
        return disposable;
      }
    }
  };
}

async function activatePlugin(
  pluginId: string,
  source: string,
  permissions: PluginPermission[]
): Promise<void> {
  deactivatePlugin(pluginId);
  const state: PluginState = {
    pluginId,
    permissions,
    beforeSend: [],
    afterSend: [],
    ipcHandlers: new Map(),
    subscriptions: []
  };
  plugins.set(pluginId, state);

  const hc = createMainPluginContext(state);
  const fullScript = `
    const module = { exports: {} };
    const exports = module.exports;
    ${source}
    const __activate = module.exports.activate;
    const __deactivate = module.exports.deactivate;
    if (typeof __activate !== 'function') {
      throw new Error('Plugin main entry must export activate(hc).');
    }
    __activate(hc);
    typeof __deactivate === 'function' ? __deactivate : undefined;
  `;

  const compartment = new Compartment({
    globals: {
      hc,
      console,
      Date,
      Math
    },
    __options__: true
  });

  const deactivate = compartment.evaluate(fullScript);
  state.deactivate = typeof deactivate === 'function' ? deactivate : undefined;
}

/**
 * Tears down one activated plugin and removes it from memory.
 *
 * @param pluginId - Plugin manifest id.
 */
function deactivatePlugin(pluginId: string): void {
  const state = plugins.get(pluginId);
  if (!state) {
    return;
  }
  try {
    state.deactivate?.();
  } catch {
    // Ignore deactivate errors during teardown.
  }
  for (const disposable of state.subscriptions) {
    disposable.dispose();
  }
  plugins.delete(pluginId);
}

/**
 * Runs all registered before-send hooks sequentially.
 *
 * @param request - Outgoing HTTP request payload.
 */
async function runBeforeSend(request: PluginHttpRequest): Promise<PluginHttpRequest> {
  const current: PluginHttpRequest = JSON.parse(JSON.stringify(request));
  for (const state of plugins.values()) {
    for (const handler of state.beforeSend) {
      try {
        await handler(current);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Plugin ${state.pluginId}: ${message}`);
      }
    }
  }
  return current;
}

/**
 * Runs all registered after-send hooks sequentially.
 *
 * @param request - Request that was sent.
 * @param response - Response payload.
 */
async function runAfterSend(
  request: PluginHttpRequest,
  response: PluginHttpResponse
): Promise<void> {
  for (const state of plugins.values()) {
    for (const handler of state.afterSend) {
      try {
        await handler(request, response);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Plugin ${state.pluginId}: ${message}`);
      }
    }
  }
}

/**
 * Invokes a plugin IPC handler registered in the main runtime.
 *
 * @param pluginId - Plugin manifest id.
 * @param channel - Registered channel name.
 * @param args - Arguments from the renderer half.
 */
async function invokeIpc(pluginId: string, channel: string, args: unknown[]): Promise<unknown> {
  const state = plugins.get(pluginId);
  if (!state) {
    throw new Error(`Plugin main runtime is not active: ${pluginId}`);
  }
  const handler = state.ipcHandlers.get(channel);
  if (!handler) {
    throw new Error(`Unknown plugin IPC channel: ${pluginId}:${channel}`);
  }
  return handler(...args);
}

/**
 * Dispatches one message from the parent process and posts a reply.
 *
 * @param message - Incoming work item from pluginRunnerHost.
 */
async function handleMessage(message: IncomingMessage): Promise<SuccessReply | ErrorReply> {
  try {
    switch (message.type) {
      case 'activate':
        await activatePlugin(message.pluginId, message.source, message.permissions);
        return { id: message.id, ok: true };
      case 'deactivate':
        deactivatePlugin(message.pluginId);
        return { id: message.id, ok: true };
      case 'beforeSend': {
        const result = await runBeforeSend(message.request);
        return { id: message.id, ok: true, result };
      }
      case 'afterSend':
        await runAfterSend(message.request, message.response);
        return { id: message.id, ok: true };
      case 'invoke': {
        const result = await invokeIpc(message.pluginId, message.channel, message.args);
        return { id: message.id, ok: true, result };
      }
      default:
        return {
          id: (message as IncomingMessage & { id: number }).id,
          ok: false,
          error: 'Unknown message type'
        };
    }
  } catch (error) {
    return {
      id: message.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

const port = process.parentPort;
if (port) {
  port.on('message', (event) => {
    const message = event.data as IncomingMessage;
    void handleMessage(message).then((reply) => {
      port.postMessage(reply);
    });
  });
}

export {};
