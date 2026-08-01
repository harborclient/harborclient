import { spawn, type ChildProcess } from 'node:child_process';
import type { LiveServerRunCommandStatus } from '@harborclient/core/types';

/** Delay before the first crash restart (ms). */
const RESTART_BACKOFF_MS = [1000, 2000, 4000, 8000, 16000] as const;

/** Stop auto-restart after this many crash restarts in a flapping window. */
const MAX_RESTART_ATTEMPTS = 10;

/** Reset the restart counter when a child stays alive this long (ms). */
const STABLE_ALIVE_MS = 60_000;

/** Wait this long after SIGTERM before SIGKILL (ms). */
const KILL_GRACE_MS = 3000;

/**
 * Status callback used when the companion process lifecycle changes.
 */
export type LiveServerRunCommandStatusListener = (
  status: LiveServerRunCommandStatus,
  error?: string
) => void;

/**
 * Callback for raw stdout/stderr chunks from the companion process.
 */
export type LiveServerRunCommandOutputListener = (
  stream: 'stdout' | 'stderr',
  chunk: string
) => void;

/**
 * Options for starting a supervised companion process.
 */
export interface StartLiveServerRunCommandOptions {
  /**
   * Command template (absolute binary + args). May contain `{{variables}}`.
   * Stored unsubstituted; {@link resolveCommand} runs before each spawn.
   */
  command: string;

  /**
   * Working directory for the child (live server root).
   */
  cwd: string;

  /**
   * When true, respawn after unexpected non-zero exit or signal.
   */
  restartOnCrash: boolean;

  /**
   * Called when status transitions (running / exited / restarting / failed).
   */
  onStatus: LiveServerRunCommandStatusListener;

  /**
   * Called with UTF-8 chunks from child stdout/stderr when provided.
   */
  onOutput?: LiveServerRunCommandOutputListener;

  /**
   * Resolves `{{variables}}` (and similar) in {@link command} before each spawn.
   * Defaults to identity when omitted.
   *
   * @param command - Unsubstituted command template from config.
   * @returns Command string ready for argv parsing.
   */
  resolveCommand?: (command: string) => string;
}

/**
 * Handle returned by {@link startLiveServerRunCommand}.
 */
export interface LiveServerRunCommandHandle {
  /**
   * Stops the companion process without triggering restart-on-crash.
   */
  stop: () => Promise<void>;
}

/**
 * Parses a run-command string into argv without invoking a shell.
 *
 * Supports single- and double-quoted segments. Does not expand env vars,
 * globs, pipes, or redirects.
 *
 * @param command - Raw command string from config.
 * @returns Non-empty argv array.
 * @throws When the command is empty or quotes are unbalanced.
 */
export function parseRunCommandArgv(command: string): string[] {
  const trimmed = command.trim();
  if (trimmed === '') {
    throw new Error('Run command is empty');
  }

  const args: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i]!;
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\' && quote !== "'") {
      escaped = true;
      continue;
    }
    if (quote != null) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current.length > 0) {
        args.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }

  if (escaped) {
    throw new Error('Run command ends with a dangling escape');
  }
  if (quote != null) {
    throw new Error('Run command has unbalanced quotes');
  }
  if (current.length > 0) {
    args.push(current);
  }
  if (args.length === 0) {
    throw new Error('Run command is empty');
  }
  return args;
}

/**
 * Returns whether an exit should be treated as a crash (eligible for restart).
 *
 * Exit code `0` with no signal is a clean exit. Non-zero codes and any signal
 * count as crashes.
 *
 * @param code - Process exit code, or null when killed by signal.
 * @param signal - Signal name when killed by signal, otherwise null.
 * @returns True when the exit looks like a crash.
 */
export function isLiveServerRunCommandCrash(
  code: number | null,
  signal: NodeJS.Signals | null
): boolean {
  if (signal != null) {
    return true;
  }
  return code !== 0;
}

/**
 * Computes the backoff delay before the next restart attempt.
 *
 * @param attemptIndex - Zero-based restart attempt index (0 = first restart).
 * @returns Delay in milliseconds.
 */
export function liveServerRunCommandBackoffMs(attemptIndex: number): number {
  const capped = Math.min(Math.max(attemptIndex, 0), RESTART_BACKOFF_MS.length - 1);
  return RESTART_BACKOFF_MS[capped]!;
}

/**
 * Starts a supervised companion process for a live server.
 *
 * Spawns without a shell. Calls {@link StartLiveServerRunCommandOptions.resolveCommand}
 * (when provided) and re-parses argv before every spawn so variable substitution
 * can refresh on crash restart. Resolves only after the child successfully emits
 * `spawn` so ENOENT and similar launch failures reject the caller. On unexpected
 * crash (non-zero / signal), optionally restarts with backoff until the attempt
 * cap. Intentional {@link LiveServerRunCommandHandle.stop} never triggers a
 * restart. Stale-generation exits are ignored after a respawn.
 *
 * @param options - Command, cwd, restart policy, optional resolver, status, and output listeners.
 * @returns Handle used to stop the process.
 * @throws When argv cannot be parsed or the initial spawn fails.
 */
export async function startLiveServerRunCommand(
  options: StartLiveServerRunCommandOptions
): Promise<LiveServerRunCommandHandle> {
  const resolveCommand = options.resolveCommand ?? ((command: string): string => command);

  let generation = 0;
  let intentionalStop = false;
  let child: ChildProcess | null = null;
  let restartAttempts = 0;
  let startedAt = 0;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;
  let killTimer: ReturnType<typeof setTimeout> | null = null;
  let stopResolve: (() => void) | null = null;

  /**
   * Clears a pending restart timer if any.
   */
  function clearRestartTimer(): void {
    if (restartTimer != null) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
  }

  /**
   * Clears a pending SIGKILL timer if any.
   */
  function clearKillTimer(): void {
    if (killTimer != null) {
      clearTimeout(killTimer);
      killTimer = null;
    }
  }

  /**
   * Forwards UTF-8 stdout/stderr chunks to {@link StartLiveServerRunCommandOptions.onOutput}.
   *
   * @param spawned - Child whose pipes should be read.
   */
  function attachOutput(spawned: ChildProcess): void {
    const onOutput = options.onOutput;
    if (onOutput == null) {
      return;
    }
    spawned.stdout?.setEncoding('utf8');
    spawned.stdout?.on('data', (chunk: string | Buffer) => {
      onOutput('stdout', typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
    });
    spawned.stderr?.setEncoding('utf8');
    spawned.stderr?.on('data', (chunk: string | Buffer) => {
      onOutput('stderr', typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
    });
  }

  /**
   * Spawns one child generation and wires exit handling.
   *
   * Resolves {@link StartLiveServerRunCommandOptions.command} and re-parses argv
   * on every spawn so crash restarts pick up updated global variables.
   *
   * @param waitForSpawn - When true, wait for the `spawn` event (initial start).
   * @returns Resolves when the child is running (or immediately when not waiting).
   * @throws When argv cannot be parsed or spawn fails (sync throw or async `error` while waiting).
   */
  function spawnChild(waitForSpawn: boolean): Promise<void> {
    clearRestartTimer();
    generation += 1;
    const thisGeneration = generation;
    startedAt = Date.now();

    let argv: string[];
    try {
      argv = parseRunCommandArgv(resolveCommand(options.command));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      options.onStatus('failed', message);
      return Promise.reject(new Error(`Failed to start run command: ${message}`));
    }
    const file = argv[0]!;
    const args = argv.slice(1);

    let spawned: ChildProcess;
    try {
      spawned = spawn(file, args, {
        cwd: options.cwd,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      options.onStatus('failed', message);
      return Promise.reject(new Error(`Failed to start run command: ${message}`));
    }

    child = spawned;
    attachOutput(spawned);

    /**
     * Wires close/error handlers shared by initial and restart spawns.
     */
    function attachLifecycle(): void {
      spawned.once('error', (error) => {
        if (thisGeneration !== generation || intentionalStop) {
          return;
        }
        child = null;
        const message = error.message || String(error);
        options.onStatus('failed', message);
        if (stopResolve != null) {
          const resolve = stopResolve;
          stopResolve = null;
          resolve();
        }
      });

      spawned.once('close', (code, signal) => {
        if (thisGeneration !== generation) {
          return;
        }
        child = null;
        if (stopResolve != null) {
          const resolve = stopResolve;
          stopResolve = null;
          resolve();
        }
        if (intentionalStop) {
          options.onStatus('exited');
          return;
        }
        if (!isLiveServerRunCommandCrash(code, signal)) {
          options.onStatus('exited');
          return;
        }

        const detail =
          signal != null
            ? `Run command killed by signal ${signal}`
            : `Run command exited with code ${code ?? 'unknown'}`;

        if (!options.restartOnCrash) {
          options.onStatus('failed', detail);
          return;
        }

        if (Date.now() - startedAt >= STABLE_ALIVE_MS) {
          restartAttempts = 0;
        }

        if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
          options.onStatus(
            'failed',
            `${detail}; gave up after ${MAX_RESTART_ATTEMPTS} restart attempts`
          );
          return;
        }

        const delay = liveServerRunCommandBackoffMs(restartAttempts);
        restartAttempts += 1;
        options.onStatus('restarting', detail);
        restartTimer = setTimeout(() => {
          restartTimer = null;
          if (intentionalStop) {
            return;
          }
          void spawnChild(false).catch((error: unknown) => {
            const message = error instanceof Error ? error.message : String(error);
            options.onStatus('failed', message);
          });
        }, delay);
      });
    }

    if (!waitForSpawn) {
      attachLifecycle();
      options.onStatus('running');
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      /**
       * Rejects the initial start when the child fails to launch.
       *
       * @param error - Spawn error from Node.
       */
      const onError = (error: Error): void => {
        spawned.off('spawn', onSpawn);
        child = null;
        const message = error.message || String(error);
        options.onStatus('failed', message);
        reject(new Error(`Failed to start run command: ${message}`));
      };

      /**
       * Resolves the initial start once the OS has created the process.
       */
      const onSpawn = (): void => {
        spawned.off('error', onError);
        attachLifecycle();
        options.onStatus('running');
        resolve();
      };

      spawned.once('error', onError);
      spawned.once('spawn', onSpawn);
    });
  }

  await spawnChild(true);

  return {
    /**
     * Stops the companion without restart-on-crash, waiting until the process
     * exits (or SIGKILL after the grace period).
     *
     * @returns Resolves when the child has exited or there is no child.
     */
    stop: async (): Promise<void> => {
      intentionalStop = true;
      clearRestartTimer();
      const active = child;
      if (active == null || active.exitCode != null || active.signalCode != null) {
        child = null;
        clearKillTimer();
        return;
      }

      await new Promise<void>((resolve) => {
        stopResolve = resolve;
        try {
          active.kill('SIGTERM');
        } catch {
          stopResolve = null;
          resolve();
          return;
        }
        clearKillTimer();
        killTimer = setTimeout(() => {
          killTimer = null;
          try {
            if (child === active && active.exitCode == null && active.signalCode == null) {
              active.kill('SIGKILL');
            }
          } catch {
            // Process may already be gone.
          }
        }, KILL_GRACE_MS);
      });
      clearKillTimer();
      child = null;
    }
  };
}
