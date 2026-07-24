import { fork, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IScriptRunner } from '@harborclient/core/interfaces';
import type { ScriptRunInput, ScriptRunResult } from '@harborclient/core/types';
import {
  buildScriptPassthrough,
  evaluateScript,
  sanitizeScriptErrorMessage
} from '@harborclient/core/scripting/scriptEvaluator';

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

/**
 * Resolves the compiled SES script runner entry shipped with @harborclient/core.
 *
 * @returns Absolute path to scriptRunner.js when built, otherwise null.
 */
function resolveCompiledRunnerPath(): string | null {
  try {
    const require = createRequire(import.meta.url);
    const corePackageJson = require.resolve('@harborclient/core/package.json');
    const candidate = join(dirname(corePackageJson), 'dist', 'scripting', 'scriptRunner.js');
    return candidate;
  } catch {
    return null;
  }
}

/**
 * Node `child_process` adapter for {@link IScriptRunner}.
 *
 * Prefers forking the compiled SES runner; falls back to in-process evaluation
 * when the core package has not been built yet (workspace development).
 */
export class NodeScriptRunner implements IScriptRunner {
  private child: ChildProcess | null = null;
  private nextId = 1;
  private readonly pending = new Map<
    number,
    {
      input: ScriptRunInput;
      resolve: (result: ScriptRunResult) => void;
      timeout: ReturnType<typeof setTimeout> | undefined;
    }
  >();
  private readonly timeoutMs: number;
  private readonly useFork: boolean;

  /**
   * @param timeoutMs - Script execution timeout (0 disables).
   * @param preferInProcess - Force in-process evaluation even when a runner build exists.
   */
  constructor(timeoutMs = 5000, preferInProcess = false) {
    this.timeoutMs = timeoutMs;
    const compiled = resolveCompiledRunnerPath();
    this.useFork = !preferInProcess && compiled != null;
  }

  /**
   * Runs a pre/post script in a forked SES process or in-process evaluator.
   *
   * @param input - Script source and request/response context.
   * @returns Script mutations, tests, and logs.
   */
  run(input: ScriptRunInput): Promise<ScriptRunResult> {
    if (!input.script.trim()) {
      return Promise.resolve(buildScriptPassthrough(input));
    }

    if (!this.useFork) {
      return this.runInProcess(input);
    }

    return this.runInChild(input);
  }

  /**
   * Kills the forked runner and clears pending work.
   */
  dispose(): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timeout);
      this.pending.delete(id);
      pending.resolve({
        ...buildScriptPassthrough(pending.input),
        error: sanitizeScriptErrorMessage('Script runner shutting down')
      });
    }
    if (this.child) {
      this.child.kill();
      this.child = null;
    }
  }

  /**
   * Evaluates a script in the current process (development fallback).
   *
   * @param input - Script run input.
   * @returns Script result.
   */
  private async runInProcess(input: ScriptRunInput): Promise<ScriptRunResult> {
    try {
      return await Promise.resolve(evaluateScript(input));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ...buildScriptPassthrough(input),
        error: sanitizeScriptErrorMessage(message)
      };
    }
  }

  /**
   * Ensures the long-lived forked runner is running.
   *
   * @returns Active child process.
   */
  private ensureChild(): ChildProcess {
    if (this.child) {
      return this.child;
    }

    const runnerPath = resolveCompiledRunnerPath();
    if (!runnerPath) {
      throw new Error('Compiled script runner is not available');
    }

    const child = fork(runnerPath, [], { stdio: ['pipe', 'pipe', 'pipe', 'ipc'] });
    this.child = child;

    child.on('message', (message: RunnerReply) => {
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }
      clearTimeout(pending.timeout);
      this.pending.delete(message.id);
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
      if (this.child === child) {
        this.child = null;
        for (const [id, pending] of this.pending) {
          clearTimeout(pending.timeout);
          this.pending.delete(id);
          pending.resolve({
            ...buildScriptPassthrough(pending.input),
            error: sanitizeScriptErrorMessage('Script runner exited unexpectedly')
          });
        }
      }
    });

    return child;
  }

  /**
   * Sends a run to the forked SES runner.
   *
   * @param input - Script run input.
   * @returns Script result.
   */
  private runInChild(input: ScriptRunInput): Promise<ScriptRunResult> {
    const child = this.ensureChild();
    const id = this.nextId++;
    const passthrough = buildScriptPassthrough(input);

    return new Promise((resolve) => {
      const timeout =
        this.timeoutMs > 0
          ? setTimeout(() => {
              this.pending.delete(id);
              this.dispose();
              resolve({
                ...passthrough,
                error: sanitizeScriptErrorMessage('Script execution timed out')
              });
            }, this.timeoutMs)
          : undefined;

      this.pending.set(id, { input, resolve, timeout });
      const message: RunMessage = { id, input };
      child.send(message);
    });
  }
}

/**
 * Returns the directory containing this module (for debugging).
 *
 * @returns Absolute directory path.
 */
export function cliAdaptersDir(): string {
  return dirname(fileURLToPath(import.meta.url));
}
