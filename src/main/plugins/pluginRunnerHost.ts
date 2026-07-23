import { utilityProcess, type UtilityProcess } from 'electron';
import { transformSync } from 'esbuild';
import { join } from 'path';
import type { EchoServerIncomingRequest } from '#/main/plugins/echoServer/types';
import {
  getEchoServerStatus,
  setEchoServerIncomingHandler,
  startEchoServer,
  stopAllEchoServers,
  stopEchoServer
} from '#/main/plugins/echoServer/pluginEchoServer';
import type {
  PluginHttpRequest,
  PluginHttpResponse,
  PluginPermission
} from '#/shared/plugin/types';

const PLUGIN_TIMEOUT_MS = 10000;

/**
 * Thrown when the plugin runner is shutting down or otherwise unavailable.
 * IPC handlers treat this as an expected no-op during app quit.
 */
export class PluginRunnerUnavailableError extends Error {
  constructor(message = 'Plugin runner is unavailable') {
    super(message);
    this.name = 'PluginRunnerUnavailableError';
  }
}

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

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

type RunnerReply = SuccessReply | ErrorReply;

interface ChildServerStartMessage {
  type: 'serverStart';
  id: number;
  pluginId: string;
  port: number;
}

interface ChildServerStopMessage {
  type: 'serverStop';
  id: number;
  pluginId: string;
}

interface ChildServerStatusMessage {
  type: 'serverStatus';
  id: number;
  pluginId: string;
}

interface ChildStorageGetMessage {
  type: 'storageGet';
  id: number;
  pluginId: string;
  key: string;
}

interface ChildStorageSetMessage {
  type: 'storageSet';
  id: number;
  pluginId: string;
  key: string;
  value: unknown;
}

interface ChildDatabaseQueryMessage {
  type: 'databaseQuery';
  id: number;
  pluginId: string;
  mode: 'get' | 'all' | 'run';
  sql: string;
  params?: unknown[];
  txnId?: string;
}

interface ChildDatabaseExecMessage {
  type: 'databaseExec';
  id: number;
  pluginId: string;
  sql: string;
}

interface ChildDatabaseTxBeginMessage {
  type: 'databaseTxBegin';
  id: number;
  pluginId: string;
}

interface ChildDatabaseTxEndMessage {
  type: 'databaseTxEnd';
  id: number;
  pluginId: string;
  txnId: string;
  action: 'commit' | 'rollback';
}

type ChildOutboundMessage =
  | ChildServerStartMessage
  | ChildServerStopMessage
  | ChildServerStatusMessage
  | ChildStorageGetMessage
  | ChildStorageSetMessage
  | ChildDatabaseQueryMessage
  | ChildDatabaseExecMessage
  | ChildDatabaseTxBeginMessage
  | ChildDatabaseTxEndMessage;

/**
 * Callbacks bridging plugin runner storage messages to persisted plugin values.
 */
export interface PluginStorageAccess {
  get: (pluginId: string, key: string) => unknown;
  set: (pluginId: string, key: string, value: unknown) => void;
}

/**
 * Callbacks bridging plugin runner database messages to the plugin database manager.
 */
export interface PluginDatabaseAccess {
  get: (
    pluginId: string,
    sql: string,
    params?: unknown[],
    txnId?: string
  ) => Promise<unknown | undefined>;
  all: (pluginId: string, sql: string, params?: unknown[], txnId?: string) => Promise<unknown[]>;
  run: (pluginId: string, sql: string, params?: unknown[], txnId?: string) => Promise<unknown>;
  exec: (pluginId: string, sql: string) => Promise<void>;
  beginTransaction: (pluginId: string) => Promise<string>;
  endTransaction: (pluginId: string, txnId: string, action: 'commit' | 'rollback') => Promise<void>;
}

let pluginStorageAccess: PluginStorageAccess | null = null;
let pluginDatabaseAccess: PluginDatabaseAccess | null = null;
let runner: UtilityProcess | null = null;
let nextId = 1;
let shuttingDown = false;
let appQuitting = false;
const pending = new Map<number, PendingCall>();

/**
 * Returns whether the plugin runner is shutting down and should reject new work.
 */
export function isPluginRunnerShuttingDown(): boolean {
  return shuttingDown;
}

/**
 * Marks the app as quitting so in-flight runner calls fail gracefully instead of
 * surfacing as unexpected IPC handler errors when Electron tears down the child.
 */
export function markPluginRunnerAppQuitting(): void {
  appQuitting = true;
}

/**
 * Registers callbacks used to read and write plugin-scoped storage from the runner child.
 *
 * @param handlers - Storage access implementation, typically backed by PluginManager.
 */
export function setPluginStorageAccess(handlers: PluginStorageAccess): void {
  pluginStorageAccess = handlers;
}

/**
 * Registers callbacks used to query plugin-scoped SQLite databases from the runner child.
 *
 * @param handlers - Database access implementation, typically backed by PluginDatabaseManager.
 */
export function setPluginDatabaseAccess(handlers: PluginDatabaseAccess): void {
  pluginDatabaseAccess = handlers;
}

/**
 * Resolves the built plugin runner entry path beside the main bundle.
 */
function resolveRunnerPath(): string {
  return join(__dirname, 'pluginRunner.js');
}

/**
 * Rejects one pending call and clears its timeout.
 *
 * @param id - Correlation id.
 * @param message - Error message.
 */
function rejectPending(id: number, message: string): void {
  const entry = pending.get(id);
  if (!entry) {
    return;
  }
  clearTimeout(entry.timeout);
  pending.delete(id);
  entry.reject(
    shuttingDown || appQuitting ? new PluginRunnerUnavailableError(message) : new Error(message)
  );
}

/**
 * Rejects every pending call when the runner exits.
 *
 * @param message - Error message applied to each pending call.
 */
function rejectAllPending(message: string): void {
  for (const id of [...pending.keys()]) {
    rejectPending(id, message);
  }
}

/**
 * Kills the active runner and clears pending calls.
 *
 * @param message - Error message applied to pending calls.
 */
function resetRunner(message: string): void {
  rejectAllPending(message);
  if (runner) {
    runner.kill();
  }
  runner = null;
}

/**
 * Posts a correlated reply to the plugin runner child process.
 *
 * @param child - Active utility process.
 * @param reply - Success or error reply payload.
 */
function postChildReply(child: UtilityProcess, reply: RunnerReply): void {
  child.postMessage(reply);
}

/**
 * Handles a child-initiated echo server start request.
 *
 * @param child - Active utility process.
 * @param message - Start request with desired listen port.
 */
async function handleChildServerStart(
  child: UtilityProcess,
  message: ChildServerStartMessage
): Promise<void> {
  try {
    const port = await startEchoServer(message.pluginId, { port: message.port });
    postChildReply(child, { id: message.id, ok: true, result: { port } });
  } catch (error) {
    postChildReply(child, {
      id: message.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Handles a child-initiated echo server stop request.
 *
 * @param child - Active utility process.
 * @param message - Stop request for one plugin.
 */
async function handleChildServerStop(
  child: UtilityProcess,
  message: ChildServerStopMessage
): Promise<void> {
  try {
    await stopEchoServer(message.pluginId);
    postChildReply(child, { id: message.id, ok: true });
  } catch (error) {
    postChildReply(child, {
      id: message.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Handles a child-initiated echo server status query.
 *
 * @param child - Active utility process.
 * @param message - Status query for one plugin.
 */
function handleChildServerStatus(child: UtilityProcess, message: ChildServerStatusMessage): void {
  postChildReply(child, {
    id: message.id,
    ok: true,
    result: getEchoServerStatus(message.pluginId)
  });
}

/**
 * Handles a child-initiated plugin storage read.
 *
 * @param child - Active utility process.
 * @param message - Storage get request with plugin id and key.
 */
export function handleChildStorageGet(
  child: UtilityProcess,
  message: ChildStorageGetMessage
): void {
  if (!pluginStorageAccess) {
    postChildReply(child, {
      id: message.id,
      ok: false,
      error: 'Plugin storage access is not configured.'
    });
    return;
  }
  try {
    const result = pluginStorageAccess.get(message.pluginId, message.key);
    postChildReply(child, { id: message.id, ok: true, result });
  } catch (error) {
    postChildReply(child, {
      id: message.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Handles a child-initiated plugin storage write.
 *
 * @param child - Active utility process.
 * @param message - Storage set request with plugin id, key, and JSON-serializable value.
 */
export function handleChildStorageSet(
  child: UtilityProcess,
  message: ChildStorageSetMessage
): void {
  if (!pluginStorageAccess) {
    postChildReply(child, {
      id: message.id,
      ok: false,
      error: 'Plugin storage access is not configured.'
    });
    return;
  }
  try {
    pluginStorageAccess.set(message.pluginId, message.key, message.value);
    postChildReply(child, { id: message.id, ok: true });
  } catch (error) {
    postChildReply(child, {
      id: message.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Handles a child-initiated plugin database query.
 *
 * @param child - Active utility process.
 * @param message - Database query request.
 */
export async function handleChildDatabaseQuery(
  child: UtilityProcess,
  message: ChildDatabaseQueryMessage
): Promise<void> {
  if (!pluginDatabaseAccess) {
    postChildReply(child, {
      id: message.id,
      ok: false,
      error: 'Plugin database access is not configured.'
    });
    return;
  }
  try {
    const params = message.params ?? [];
    const result =
      message.mode === 'get'
        ? await pluginDatabaseAccess.get(message.pluginId, message.sql, params, message.txnId)
        : message.mode === 'all'
          ? await pluginDatabaseAccess.all(message.pluginId, message.sql, params, message.txnId)
          : await pluginDatabaseAccess.run(message.pluginId, message.sql, params, message.txnId);
    postChildReply(child, { id: message.id, ok: true, result });
  } catch (error) {
    postChildReply(child, {
      id: message.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Handles a child-initiated plugin database exec request.
 *
 * @param child - Active utility process.
 * @param message - Exec request with SQL script.
 */
export async function handleChildDatabaseExec(
  child: UtilityProcess,
  message: ChildDatabaseExecMessage
): Promise<void> {
  if (!pluginDatabaseAccess) {
    postChildReply(child, {
      id: message.id,
      ok: false,
      error: 'Plugin database access is not configured.'
    });
    return;
  }
  try {
    await pluginDatabaseAccess.exec(message.pluginId, message.sql);
    postChildReply(child, { id: message.id, ok: true });
  } catch (error) {
    postChildReply(child, {
      id: message.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Handles a child-initiated plugin database transaction begin request.
 *
 * @param child - Active utility process.
 * @param message - Begin request for one plugin.
 */
export async function handleChildDatabaseTxBegin(
  child: UtilityProcess,
  message: ChildDatabaseTxBeginMessage
): Promise<void> {
  if (!pluginDatabaseAccess) {
    postChildReply(child, {
      id: message.id,
      ok: false,
      error: 'Plugin database access is not configured.'
    });
    return;
  }
  try {
    const txnId = await pluginDatabaseAccess.beginTransaction(message.pluginId);
    postChildReply(child, { id: message.id, ok: true, result: txnId });
  } catch (error) {
    postChildReply(child, {
      id: message.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Handles a child-initiated plugin database transaction end request.
 *
 * @param child - Active utility process.
 * @param message - Commit or rollback request.
 */
export async function handleChildDatabaseTxEnd(
  child: UtilityProcess,
  message: ChildDatabaseTxEndMessage
): Promise<void> {
  if (!pluginDatabaseAccess) {
    postChildReply(child, {
      id: message.id,
      ok: false,
      error: 'Plugin database access is not configured.'
    });
    return;
  }
  try {
    await pluginDatabaseAccess.endTransaction(message.pluginId, message.txnId, message.action);
    postChildReply(child, { id: message.id, ok: true });
  } catch (error) {
    postChildReply(child, {
      id: message.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Routes child-initiated server control messages to the echo server module.
 *
 * @param child - Active utility process.
 * @param message - Outbound message from the SES child.
 */
function handleChildOutboundMessage(child: UtilityProcess, message: ChildOutboundMessage): void {
  switch (message.type) {
    case 'serverStart':
      void handleChildServerStart(child, message);
      return;
    case 'serverStop':
      void handleChildServerStop(child, message);
      return;
    case 'serverStatus':
      handleChildServerStatus(child, message);
      return;
    case 'storageGet':
      handleChildStorageGet(child, message);
      return;
    case 'storageSet':
      handleChildStorageSet(child, message);
      return;
    case 'databaseQuery':
      void handleChildDatabaseQuery(child, message);
      return;
    case 'databaseExec':
      void handleChildDatabaseExec(child, message);
      return;
    case 'databaseTxBegin':
      void handleChildDatabaseTxBegin(child, message);
      return;
    case 'databaseTxEnd':
      void handleChildDatabaseTxEnd(child, message);
      return;
    default:
      return;
  }
}

/**
 * Routes incoming echo HTTP requests through the plugin runner child.
 *
 * @param pluginId - Plugin manifest id owning the server.
 * @param request - Serializable HTTP request snapshot.
 */
async function routeEchoRequest(
  pluginId: string,
  request: EchoServerIncomingRequest
): Promise<unknown> {
  try {
    const result = await postMessage({
      type: 'echoRequest',
      pluginId,
      request
    });
    return result;
  } catch {
    return undefined;
  }
}

/**
 * Attaches lifecycle and message handlers to the plugin runner process.
 *
 * @param child - Utility process forked from pluginRunner.js.
 */
function attachRunnerHandlers(child: UtilityProcess): void {
  child.on('message', (message: RunnerReply | ChildOutboundMessage) => {
    if ('type' in message && message.type === 'serverStart') {
      handleChildOutboundMessage(child, message);
      return;
    }
    if ('type' in message && message.type === 'serverStop') {
      handleChildOutboundMessage(child, message);
      return;
    }
    if ('type' in message && message.type === 'serverStatus') {
      handleChildOutboundMessage(child, message);
      return;
    }
    if ('type' in message && message.type === 'storageGet') {
      handleChildOutboundMessage(child, message);
      return;
    }
    if ('type' in message && message.type === 'storageSet') {
      handleChildOutboundMessage(child, message);
      return;
    }
    if ('type' in message && message.type === 'databaseQuery') {
      handleChildOutboundMessage(child, message);
      return;
    }
    if ('type' in message && message.type === 'databaseExec') {
      handleChildOutboundMessage(child, message);
      return;
    }
    if ('type' in message && message.type === 'databaseTxBegin') {
      handleChildOutboundMessage(child, message);
      return;
    }
    if ('type' in message && message.type === 'databaseTxEnd') {
      handleChildOutboundMessage(child, message);
      return;
    }

    const reply = message as RunnerReply;
    const entry = pending.get(reply.id);
    if (!entry) {
      return;
    }
    clearTimeout(entry.timeout);
    pending.delete(reply.id);
    if (reply.ok) {
      entry.resolve(reply.result);
      return;
    }
    entry.reject(new Error(reply.error));
  });

  child.on('exit', () => {
    if (runner !== child) {
      return;
    }
    if (shuttingDown) {
      runner = null;
      return;
    }
    resetRunner('Plugin runner exited unexpectedly');
  });
}

/**
 * Ensures the long-lived plugin runner process is running.
 */
function ensureRunner(): UtilityProcess {
  if (shuttingDown) {
    throw new PluginRunnerUnavailableError('Plugin runner shutting down');
  }
  if (runner) {
    return runner;
  }
  const child = utilityProcess.fork(resolveRunnerPath());
  runner = child;
  attachRunnerHandlers(child);
  setEchoServerIncomingHandler(routeEchoRequest);
  return child;
}

/**
 * Posts one message to the plugin runner and waits for a reply.
 *
 * @param payload - Message payload excluding the correlation id.
 */
function postMessage(payload: Record<string, unknown>): Promise<unknown> {
  const child = ensureRunner();
  const id = nextId++;

  return new Promise<unknown>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      resetRunner('Plugin runner timed out');
      reject(new Error('Plugin runner timed out'));
    }, PLUGIN_TIMEOUT_MS);

    pending.set(id, { resolve, reject, timeout });
    child.postMessage({ id, ...payload });
  });
}

/**
 * Converts a bundled ESM plugin main entry into CommonJS for SES evaluation.
 *
 * @param source - Raw plugin main bundle source.
 */
function toCommonJsMainSource(source: string): string {
  const result = transformSync(source, {
    loader: 'js',
    format: 'cjs',
    platform: 'neutral'
  });
  return result.code;
}

/**
 * Activates a plugin main entry in the SES utilityProcess runner.
 *
 * @param pluginId - Plugin manifest id.
 * @param source - Bundled main entry source.
 * @param permissions - Granted plugin permissions.
 */
export async function activatePluginMain(
  pluginId: string,
  source: string,
  permissions: PluginPermission[]
): Promise<void> {
  await postMessage({
    type: 'activate',
    pluginId,
    source: toCommonJsMainSource(source),
    permissions
  });
}

/**
 * Deactivates a plugin main entry in the SES utilityProcess runner.
 *
 * @param pluginId - Plugin manifest id.
 */
export async function deactivatePluginMain(pluginId: string): Promise<void> {
  await stopEchoServer(pluginId);
  await postMessage({
    type: 'deactivate',
    pluginId
  });
}

/**
 * Runs registered plugin before-send hooks.
 *
 * @param request - Outgoing HTTP request payload.
 */
export async function runPluginBeforeSendHooks(
  request: PluginHttpRequest
): Promise<PluginHttpRequest> {
  const result = await postMessage({
    type: 'beforeSend',
    request
  });
  return (result as PluginHttpRequest | undefined) ?? request;
}

/**
 * Runs registered plugin after-send hooks.
 *
 * @param request - Request that was sent.
 * @param response - Response payload.
 */
export async function runPluginAfterSendHooks(
  request: PluginHttpRequest,
  response: PluginHttpResponse
): Promise<void> {
  await postMessage({
    type: 'afterSend',
    request,
    response
  });
}

/**
 * Invokes a plugin IPC handler in the main runtime.
 *
 * @param pluginId - Plugin manifest id.
 * @param channel - Registered channel name.
 * @param args - Arguments from the renderer half.
 */
export async function invokePluginIpc(
  pluginId: string,
  channel: string,
  args: unknown[]
): Promise<unknown> {
  return postMessage({
    type: 'invoke',
    pluginId,
    channel,
    args
  });
}

/**
 * Kills the plugin runner process during app shutdown.
 */
export function disposePluginRunner(): void {
  shuttingDown = true;
  setEchoServerIncomingHandler(null);
  void stopAllEchoServers();
  resetRunner('Plugin runner shutting down');
}
