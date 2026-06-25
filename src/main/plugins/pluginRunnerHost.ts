import { utilityProcess, type UtilityProcess } from 'electron';
import { transformSync } from 'esbuild';
import { join } from 'path';
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

let runner: UtilityProcess | null = null;
let nextId = 1;
let shuttingDown = false;
const pending = new Map<number, PendingCall>();

/**
 * Returns whether the plugin runner is shutting down and should reject new work.
 */
export function isPluginRunnerShuttingDown(): boolean {
  return shuttingDown;
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
  entry.reject(new Error(message));
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
 * Attaches lifecycle and message handlers to the plugin runner process.
 *
 * @param child - Utility process forked from pluginRunner.js.
 */
function attachRunnerHandlers(child: UtilityProcess): void {
  child.on('message', (message: RunnerReply) => {
    const entry = pending.get(message.id);
    if (!entry) {
      return;
    }
    clearTimeout(entry.timeout);
    pending.delete(message.id);
    if (message.ok) {
      entry.resolve(message.result);
      return;
    }
    entry.reject(new Error(message.error));
  });

  child.on('exit', () => {
    if (runner === child) {
      resetRunner('Plugin runner exited unexpectedly');
    }
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
  resetRunner('Plugin runner shutting down');
}
