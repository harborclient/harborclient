import type { ScriptRunInput, ScriptRunResult } from '../types/script';

/**
 * Runs pre/post request scripts in an isolated sandbox.
 *
 * GUI implements this with Electron `utilityProcess`; CLI uses `child_process`.
 */
export interface IScriptRunner {
  /**
   * Evaluates a script with the given request/response context.
   *
   * @param input - Script source, phase, and variable context.
   * @returns Mutated request, variables, tests, and logs from the sandbox.
   */
  run(input: ScriptRunInput): Promise<ScriptRunResult>;

  /**
   * Releases runner resources (kills the child process, clears pending work).
   */
  dispose(): void;
}
