import 'ses';
import { createScriptContext } from './pluginScriptContext';
import type { ScriptRunContextInput } from '#/main/scripting/scriptApi';
import { runEchoRequestHandlers } from '#/main/plugins/echoServer/runEchoRequestHandlers';
import type { EchoServerIncomingRequest } from '#/main/plugins/echoServer/types';
import '#/shared/plugin/databaseTypes';
import type {
  PluginHttpRequest,
  PluginHttpResponse,
  PluginPermission
} from '#/shared/plugin/types';
import { createPluginDatabaseApi } from '#/shared/plugin/pluginDatabaseApi';

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

interface EchoRequestMessage {
  type: 'echoRequest';
  id: number;
  pluginId: string;
  request: EchoServerIncomingRequest;
}

type IncomingMessage =
  | ActivateMessage
  | DeactivateMessage
  | BeforeSendMessage
  | AfterSendMessage
  | InvokeMessage
  | EchoRequestMessage;

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

interface ChildPendingCall {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
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
  onRequestHandlers: Array<(request: EchoServerIncomingRequest) => unknown | Promise<unknown>>;
  /** Optional deactivate export captured from the activation compartment. */
  deactivate?: () => void;
}

const plugins = new Map<string, PluginState>();
let nextChildId = 1;
const childPending = new Map<number, ChildPendingCall>();

/**
 * Posts a child-initiated message to the parent and waits for a correlated reply.
 *
 * @param payload - Outbound message excluding the correlation id.
 */
function postToParent(payload: Record<string, unknown>): Promise<unknown> {
  const port = process.parentPort;
  if (!port) {
    throw new Error('Plugin runner parent port is unavailable.');
  }

  const id = nextChildId++;

  return new Promise<unknown>((resolve, reject) => {
    childPending.set(id, { resolve, reject });
    port.postMessage({ id, ...payload });
  });
}

/**
 * Resolves or rejects one child-initiated pending call from a parent reply.
 *
 * @param reply - Parent reply correlated by id.
 */
function settleChildPending(reply: SuccessReply | ErrorReply): void {
  const entry = childPending.get(reply.id);
  if (!entry) {
    return;
  }
  childPending.delete(reply.id);
  if (reply.ok) {
    entry.resolve(reply.result);
    return;
  }
  entry.reject(new Error(reply.error));
}

/**
 * Registers a disposable cleanup and tracks it for plugin teardown.
 *
 * @param subscriptions - Plugin subscription list updated on activation.
 * @param dispose - Cleanup invoked when the subscription is disposed.
 * @returns Disposable handle returned to plugin code.
 */
function registerDisposable(
  subscriptions: Array<{ dispose: () => void }>,
  dispose: () => void
): { dispose: () => void } {
  const disposable = { dispose };
  subscriptions.push(disposable);
  return disposable;
}

/**
 * Adds a handler to a subscription array and returns a disposable that removes it.
 *
 * @param subscriptions - Plugin subscription list updated on activation.
 * @param handlers - Handler array to append to.
 * @param handler - Handler registered by the plugin.
 * @returns Disposable handle returned to plugin code.
 */
function subscribeHandler<T>(
  subscriptions: Array<{ dispose: () => void }>,
  handlers: T[],
  handler: T
): { dispose: () => void } {
  handlers.push(handler);
  return registerDisposable(subscriptions, () => {
    const index = handlers.indexOf(handler);
    if (index >= 0) {
      handlers.splice(index, 1);
    }
  });
}

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
      get: async <T>(key: string) => {
        assertPermission('storage');
        return (await postToParent({
          type: 'storageGet',
          pluginId: state.pluginId,
          key
        })) as T | undefined;
      },
      set: async <T>(key: string, value: T) => {
        assertPermission('storage');
        await postToParent({
          type: 'storageSet',
          pluginId: state.pluginId,
          key,
          value
        });
      }
    },
    database: createPluginDatabaseApi({
      query: (mode, sql, params, txnId) => {
        assertPermission('database');
        return postToParent({
          type: 'databaseQuery',
          pluginId: state.pluginId,
          mode,
          sql,
          params,
          txnId
        });
      },
      exec: (sql) => {
        assertPermission('database');
        return postToParent({
          type: 'databaseExec',
          pluginId: state.pluginId,
          sql
        }) as Promise<void>;
      },
      beginTransaction: () => {
        assertPermission('database');
        return postToParent({
          type: 'databaseTxBegin',
          pluginId: state.pluginId
        }) as Promise<string>;
      },
      endTransaction: (txnId, action) => {
        assertPermission('database');
        return postToParent({
          type: 'databaseTxEnd',
          pluginId: state.pluginId,
          txnId,
          action
        }) as Promise<void>;
      }
    }),
    http: {
      onBeforeSend: (handler: (request: PluginHttpRequest) => void | Promise<void>) => {
        assertPermission('http');
        return subscribeHandler(subscriptions, state.beforeSend, handler);
      },
      onAfterSend: (
        handler: (request: PluginHttpRequest, response: PluginHttpResponse) => void | Promise<void>
      ) => {
        assertPermission('http');
        return subscribeHandler(subscriptions, state.afterSend, handler);
      }
    },
    ipc: {
      handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
        assertPermission('ipc');
        state.ipcHandlers.set(channel, handler);
        return registerDisposable(subscriptions, () => {
          state.ipcHandlers.delete(channel);
        });
      }
    },
    scripts: {
      createContext: (init?: Partial<ScriptRunContextInput>) => createScriptContext(init)
    },
    server: {
      start: async (options?: { port?: number }) => {
        assertPermission('server');
        const result = (await postToParent({
          type: 'serverStart',
          pluginId: state.pluginId,
          port: options?.port ?? 0
        })) as { port: number } | undefined;
        return { port: result?.port ?? 0 };
      },
      stop: async () => {
        assertPermission('server');
        await postToParent({
          type: 'serverStop',
          pluginId: state.pluginId
        });
      },
      onRequest: (handler: (request: EchoServerIncomingRequest) => unknown | Promise<unknown>) => {
        assertPermission('server');
        return subscribeHandler(subscriptions, state.onRequestHandlers, handler);
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
    subscriptions: [],
    onRequestHandlers: []
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
 * Handles an echo server request routed from the Electron main process.
 *
 * @param message - Incoming echo request with serialized HTTP snapshot.
 */
async function handleEchoRequest(message: EchoRequestMessage): Promise<SuccessReply | ErrorReply> {
  const state = plugins.get(message.pluginId);
  if (!state?.onRequestHandlers.length) {
    return { id: message.id, ok: true, result: undefined };
  }
  try {
    const result = await runEchoRequestHandlers(state.onRequestHandlers, message.request);
    return {
      id: message.id,
      ok: true,
      result
    };
  } catch (error) {
    return {
      id: message.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
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
      case 'echoRequest':
        return await handleEchoRequest(message);
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
    const message = event.data as IncomingMessage | SuccessReply | ErrorReply;

    if (
      typeof message === 'object' &&
      message !== null &&
      'id' in message &&
      'ok' in message &&
      !('type' in message)
    ) {
      settleChildPending(message as SuccessReply | ErrorReply);
      return;
    }

    if (
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      message.type === 'echoRequest'
    ) {
      void handleEchoRequest(message as EchoRequestMessage).then((reply) => {
        port.postMessage(reply);
      });
      return;
    }

    void handleMessage(message as IncomingMessage).then((reply) => {
      port.postMessage(reply);
    });
  });
}

export {};
