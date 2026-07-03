import { utilityProcess, type UtilityProcess } from 'electron';
import { join } from 'path';
import type { ScriptRunInput, ScriptRunResult } from '#/shared/types';
import {
  buildScriptPassthrough,
  sanitizeScriptErrorMessage
} from '#/main/scripting/scriptEvaluator';
import { getGeneralSettings } from '#/main/settings/generalSettings';

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

interface PendingRun {
  input: ScriptRunInput;
  resolve: (result: ScriptRunResult) => void;
  timeout: ReturnType<typeof setTimeout> | undefined;
}

let runner: UtilityProcess | null = null;
let nextRunId = 1;
const pendingRuns = new Map<number, PendingRun>();

/**
 * Resolves the built script runner entry path beside the main bundle.
 *
 * @returns Absolute path to `scriptRunner.js` in the main output directory.
 */
function resolveRunnerPath(): string {
  return join(__dirname, 'scriptRunner.js');
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
 * Attaches lifecycle and message handlers to a newly spawned runner process.
 *
 * @param child - Utility process forked from the script runner entry.
 */
function attachRunnerHandlers(child: UtilityProcess): void {
  child.on('message', (message: RunnerReply) => {
    const pending = pendingRuns.get(message.id);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    pendingRuns.delete(message.id);

    if (message.ok) {
      pending.resolve(message.result);
      return;
    }

    pending.resolve({
      ...buildScriptPassthrough(pending.input),
      error: sanitizeScriptErrorMessage(message.error)
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
