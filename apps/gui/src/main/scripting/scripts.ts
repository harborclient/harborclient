import type { ScriptRunInput, ScriptRunResult } from '#/shared/types';
import { runScriptInProcess } from './scriptRunnerHost';

/**
 * Runs a pre/post script in the SES-hardened utilityProcess runner.
 *
 * Empty scripts short-circuit locally; all other execution is delegated to the
 * long-lived script runner child process.
 *
 * @param input - Script source, phase, request/response context, and variables.
 * @returns Mutated request, variable sets, tests, and logs from the sandbox.
 */
export async function runScript(input: ScriptRunInput): Promise<ScriptRunResult> {
  return runScriptInProcess(input);
}
