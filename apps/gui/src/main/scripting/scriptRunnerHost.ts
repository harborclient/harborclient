import { utilityProcess, type UtilityProcess } from 'electron';
import { resolveFromMainOut } from '#/main/paths';
import type {
  GitSettings,
  ScriptRunInput,
  ScriptRunResult,
  SendRequestInput,
  SendResult
} from '@harborclient/core/types';
import type { IScriptRunner } from '@harborclient/core/interfaces';
import type { ICookieJar } from '#/main/cookieJar/ICookieJar';
import {
  buildScriptPassthrough,
  sanitizeScriptErrorMessage
} from '@harborclient/core/scripting/scriptEvaluator';
import { executeHttpSend, isScriptNetworkAllowed } from '#/main/network/executeHttpSend';
import {
  getGeneralSettings,
  isScriptFileReadAllowed,
  isScriptFileWriteAllowed
} from '#/main/settings/generalSettings';
import { listStorageConnections } from '#/main/settings/storageSettings';
import { getAiSettings } from '#/main/settings/aiSettings';
import { listHubLlmModels } from '#/main/ai/hubChatStep';
import { getGithubModelsStatus } from '#/main/ai/githubModelsAuth';
import { runChatCompletionStep } from '#/main/ai/completeChatTurn';
import { hasAvailableAiModels } from '@harborclient/core/ai/models';
import { resolveScriptAskModel } from '@harborclient/core/ai/resolveScriptAskModel';
import { buildHcAskContextMessage } from '@harborclient/core/ai/hcAskContext';
import { homedir } from 'os';
import {
  executeScriptFileRequest,
  scriptFileAccessForOp,
  type ScriptFileRequest
} from '@harborclient/core/scripting/scriptFileOperations';
import type { ScriptAskRequest } from './scriptApi';

/**
 * Resolves the script execution timeout from persisted general settings.
 *
 * @returns Timeout in milliseconds, or 0 when script timeouts are disabled.
 */
export function resolveScriptTimeoutMs(): number {
  return getGeneralSettings().scriptTimeoutMs;
}

interface RunMessage {
  id: number;
  input: ScriptRunInput;
}

interface SuccessReply {
  id: number;
  ok: true;
  result: ScriptRunResult;
}

interface ErrorReply {
  id: number;
  ok: false;
  error: string;
}

type RunnerReply = SuccessReply | ErrorReply;

interface NetRequestMessage {
  kind: 'net';
  runId: number;
  netId: number;
  req: SendRequestInput;
}

interface NetSuccessReply {
  kind: 'net-reply';
  runId: number;
  netId: number;
  ok: true;
  result: SendResult;
}

interface NetErrorReply {
  kind: 'net-reply';
  runId: number;
  netId: number;
  ok: false;
  error: string;
}

interface FileRequestMessage {
  kind: 'file';
  runId: number;
  fileId: number;
  req: ScriptFileRequest;
}

interface FileSuccessReply {
  kind: 'file-reply';
  runId: number;
  fileId: number;
  ok: true;
  result: unknown;
}

interface FileErrorReply {
  kind: 'file-reply';
  runId: number;
  fileId: number;
  ok: false;
  error: string;
}

interface AskRequestMessage {
  kind: 'ask';
  runId: number;
  askId: number;
  req: ScriptAskRequest;
}

interface AskSuccessReply {
  kind: 'ask-reply';
  runId: number;
  askId: number;
  ok: true;
  result: string | null;
}

interface AskErrorReply {
  kind: 'ask-reply';
  runId: number;
  askId: number;
  ok: false;
  error: string;
}

type ChildMessage = RunnerReply | NetRequestMessage | FileRequestMessage | AskRequestMessage;

interface PendingRun {
  input: ScriptRunInput;
  resolve: (result: ScriptRunResult) => void;
  timeout: ReturnType<typeof setTimeout> | undefined;
}

let runner: UtilityProcess | null = null;
let nextRunId = 1;
const pendingRuns = new Map<number, PendingRun>();
let scriptCookieJar: ICookieJar | null = null;

/**
 * Resolves the GUI's configured script filesystem root for one run.
 *
 * Git-backed collections use their checkout while other scripts use the
 * configured root, falling back to the current user's home directory.
 *
 * @param context - Active collection connection context from the sandbox.
 * @returns Absolute root directory allowed for this script.
 */
function resolveGuiScriptFileRoot(context?: { connectionId?: string | null }): string {
  const connectionId = context?.connectionId?.trim();
  const connection = connectionId
    ? listStorageConnections().find((entry) => entry.id === connectionId)
    : undefined;
  if (connection?.type === 'git') {
    const repoPath = (connection.settings as GitSettings).repoPath?.trim();
    if (repoPath) {
      return repoPath;
    }
  }
  return getGeneralSettings().scriptFileRoot.trim() || homedir();
}

/**
 * Supplies the cookie jar used by hc.sendRequest network bridging.
 *
 * @param cookieJar - Shared cookie jar from IPC registration.
 */
export function initScriptRunnerHost(cookieJar: ICookieJar): void {
  scriptCookieJar = cookieJar;
}

/**
 * Resolves the built script runner entry path beside the main bundle.
 *
 * @returns Absolute path to `scriptRunner.js` in the main output directory.
 */
function resolveRunnerPath(): string {
  return resolveFromMainOut('scriptRunner.js');
}

/**
 * Clears a pending run and resolves it with an error-shaped script result.
 *
 * @param id - Correlation id for the pending run.
 * @param message - Error message shown in the send console.
 */
function rejectPendingRun(id: number, message: string): void {
  const pending = pendingRuns.get(id);
  if (!pending) {
    return;
  }

  clearTimeout(pending.timeout);
  pendingRuns.delete(id);
  pending.resolve({
    ...buildScriptPassthrough(pending.input),
    error: sanitizeScriptErrorMessage(message)
  });
}

/**
 * Rejects every in-flight run when the runner exits or is killed.
 *
 * @param message - Error message applied to each pending run.
 */
function rejectAllPending(message: string): void {
  for (const id of [...pendingRuns.keys()]) {
    rejectPendingRun(id, message);
  }
}

/**
 * Kills the active runner process and clears pending state so the next call respawns.
 *
 * @param message - Error message applied to any in-flight runs.
 */
function resetRunner(message: string): void {
  rejectAllPending(message);

  if (runner) {
    runner.kill();
  }

  runner = null;
}

/**
 * Handles an hc.sendRequest bridge call from the utility process runner.
 *
 * @param child - Utility process that initiated the network call.
 * @param message - Network request payload from the script sandbox.
 */
async function handleScriptNetworkRequest(
  child: UtilityProcess,
  message: NetRequestMessage
): Promise<void> {
  const reply = (payload: NetSuccessReply | NetErrorReply): void => {
    child.postMessage(payload);
  };

  if (!isScriptNetworkAllowed()) {
    reply({
      kind: 'net-reply',
      runId: message.runId,
      netId: message.netId,
      ok: false,
      error: 'Script network requests are disabled in Settings → General'
    });
    return;
  }

  if (!scriptCookieJar) {
    reply({
      kind: 'net-reply',
      runId: message.runId,
      netId: message.netId,
      ok: false,
      error: 'Script network bridge is not initialized'
    });
    return;
  }

  try {
    const result = await executeHttpSend(message.req, scriptCookieJar);
    reply({
      kind: 'net-reply',
      runId: message.runId,
      netId: message.netId,
      ok: true,
      result
    });
  } catch (err) {
    const rawMessage =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : String(err);
    reply({
      kind: 'net-reply',
      runId: message.runId,
      netId: message.netId,
      ok: false,
      error: sanitizeScriptErrorMessage(rawMessage)
    });
  }
}

/**
 * Handles an hc.fs / hc.parse bridge call from the utility process runner.
 *
 * @param child - Utility process that initiated the file call.
 * @param message - File request payload from the script sandbox.
 */
function handleScriptFileRequest(child: UtilityProcess, message: FileRequestMessage): void {
  const reply = (payload: FileSuccessReply | FileErrorReply): void => {
    child.postMessage(payload);
  };

  const access = scriptFileAccessForOp(message.req.op);
  if (access === 'read' && !isScriptFileReadAllowed()) {
    reply({
      kind: 'file-reply',
      runId: message.runId,
      fileId: message.fileId,
      ok: false,
      error: 'Script file read is disabled in Settings → General'
    });
    return;
  }
  if (access === 'write' && !isScriptFileWriteAllowed()) {
    reply({
      kind: 'file-reply',
      runId: message.runId,
      fileId: message.fileId,
      ok: false,
      error: 'Script file write is disabled in Settings → General'
    });
    return;
  }

  try {
    const pending = pendingRuns.get(message.runId);
    const result = executeScriptFileRequest(
      message.req,
      {
        resolveRoot: resolveGuiScriptFileRoot
      },
      { connectionId: pending?.input.collection?.connectionId }
    );
    reply({
      kind: 'file-reply',
      runId: message.runId,
      fileId: message.fileId,
      ok: true,
      result
    });
  } catch (err) {
    const rawMessage =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : String(err);
    reply({
      kind: 'file-reply',
      runId: message.runId,
      fileId: message.fileId,
      ok: false,
      error: sanitizeScriptErrorMessage(rawMessage)
    });
  }
}

/**
 * Resolves and runs a one-shot `hc.ask` completion in the main process.
 *
 * Returns null when AI is not configured or the model/source pair cannot be matched.
 * LLM failures throw so the script bridge can reject the sandbox promise.
 *
 * When `runInput` is provided, injects a request/response snapshot so the model can
 * answer questions about the current send (for example response sizeBytes).
 *
 * @param req - Prompt, model label/id, and source group label from the sandbox.
 * @param runInput - Pending script run context for the active send.
 * @returns Model text, or null when unavailable / unresolved.
 */
export async function executeScriptAsk(
  req: ScriptAskRequest,
  runInput?: ScriptRunInput
): Promise<string | null> {
  const settings = getAiSettings();
  const hubGroups = await listHubLlmModels();
  const githubConnected = getGithubModelsStatus().connected;

  if (!hasAvailableAiModels(settings, hubGroups, githubConnected)) {
    return null;
  }

  const option = resolveScriptAskModel(req.model, settings, hubGroups, githubConnected);
  if (!option) {
    return null;
  }

  const contextMessage = buildHcAskContextMessage(runInput);
  const messages = [
    ...(contextMessage ? [{ role: 'user' as const, content: contextMessage }] : []),
    { role: 'user' as const, content: req.prompt }
  ];

  const step = await runChatCompletionStep({
    model: option.id,
    messages,
    ...(option.source === 'hub' && option.hubId ? { hubId: option.hubId } : {}),
    agentVariant: 'hcAsk'
  });

  return step.content;
}

/**
 * Handles an hc.ask bridge call from the utility process runner.
 *
 * Resolves to null when AI is not configured or the model/source pair cannot be
 * matched; otherwise runs a one-shot completion with agentVariant `hcAsk`,
 * including the pending run's request/response snapshot.
 *
 * @param child - Utility process that initiated the ask call.
 * @param message - Ask request payload from the script sandbox.
 */
async function handleScriptAskRequest(
  child: UtilityProcess,
  message: AskRequestMessage
): Promise<void> {
  const reply = (payload: AskSuccessReply | AskErrorReply): void => {
    child.postMessage(payload);
  };

  try {
    const runInput = pendingRuns.get(message.runId)?.input;
    const result = await executeScriptAsk(message.req, runInput);
    reply({
      kind: 'ask-reply',
      runId: message.runId,
      askId: message.askId,
      ok: true,
      result
    });
  } catch (err) {
    const rawMessage =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : String(err);
    reply({
      kind: 'ask-reply',
      runId: message.runId,
      askId: message.askId,
      ok: false,
      error: sanitizeScriptErrorMessage(rawMessage)
    });
  }
}

/**
 * Attaches lifecycle and message handlers to a newly spawned runner process.
 *
 * @param child - Utility process forked from the script runner entry.
 */
function attachRunnerHandlers(child: UtilityProcess): void {
  child.on('message', (message: ChildMessage) => {
    if ('kind' in message && message.kind === 'net') {
      void handleScriptNetworkRequest(child, message);
      return;
    }

    if ('kind' in message && message.kind === 'file') {
      handleScriptFileRequest(child, message);
      return;
    }

    if ('kind' in message && message.kind === 'ask') {
      void handleScriptAskRequest(child, message);
      return;
    }

    const reply = message as RunnerReply;
    const pending = pendingRuns.get(reply.id);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    pendingRuns.delete(reply.id);

    if (reply.ok) {
      pending.resolve(reply.result);
      return;
    }

    pending.resolve({
      ...buildScriptPassthrough(pending.input),
      error: sanitizeScriptErrorMessage(reply.error)
    });
  });

  child.on('exit', () => {
    if (runner === child) {
      resetRunner('Script runner exited unexpectedly');
    }
  });
}

/**
 * Ensures the long-lived SES script runner process is running.
 *
 * @returns Active utility process handle.
 */
function ensureRunner(): UtilityProcess {
  if (runner) {
    return runner;
  }

  const child = utilityProcess.fork(resolveRunnerPath());
  runner = child;
  attachRunnerHandlers(child);
  return child;
}

/**
 * Runs a pre/post script in the SES utilityProcess runner.
 *
 * Spawns the runner lazily on first use, reuses it across sends, and kills it
 * on timeout or crash so the next call starts a fresh process.
 *
 * @param input - Script source, phase, request/response context, and variables.
 * @returns Mutated request, variable sets, tests, and logs from the sandbox.
 */
export function runScriptInProcess(input: ScriptRunInput): Promise<ScriptRunResult> {
  const passthrough = buildScriptPassthrough(input);

  if (!input.script.trim()) {
    return Promise.resolve(passthrough);
  }

  const child = ensureRunner();
  const id = nextRunId++;
  const timeoutMs = resolveScriptTimeoutMs();

  return new Promise<ScriptRunResult>((resolve) => {
    const timeout =
      timeoutMs > 0
        ? setTimeout(() => {
            pendingRuns.delete(id);
            resetRunner('Script execution timed out');
            resolve({
              ...passthrough,
              error: sanitizeScriptErrorMessage('Script execution timed out')
            });
          }, timeoutMs)
        : undefined;

    pendingRuns.set(id, { input, resolve, timeout });

    const message: RunMessage = { id, input };
    child.postMessage(message);
  });
}

/**
 * Kills the script runner process and clears pending runs during app shutdown.
 */
export function disposeScriptRunner(): void {
  resetRunner('Script runner shutting down');
}

/**
 * Electron utility-process adapter for the portable script runner contract.
 *
 * The adapter keeps Electron process lifecycle concerns in the GUI while
 * callers can depend only on Core's {@link IScriptRunner} interface.
 */
export class ElectronScriptRunner implements IScriptRunner {
  /**
   * Runs one script through the shared Electron utility process.
   *
   * @param input - Script source and execution context.
   * @returns Script mutations, tests, logs, and any execution error.
   */
  run(input: ScriptRunInput): Promise<ScriptRunResult> {
    return runScriptInProcess(input);
  }

  /**
   * Releases the shared utility process during application shutdown.
   */
  dispose(): void {
    disposeScriptRunner();
  }
}
