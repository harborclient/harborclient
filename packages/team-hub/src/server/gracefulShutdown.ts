import type { FastifyInstance } from 'fastify';
import { disposeHubMcpConnections } from '#/server/llm/mcpClient.js';
import { disconnectAll, type RuntimeContext } from '#/server/runtimeContext.js';
import { beginShuttingDown } from '#/server/shutdownState.js';

/**
 * Default force-exit deadline in milliseconds.
 *
 * Fits a 30s Kubernetes `terminationGracePeriodSeconds` with headroom for
 * orchestrator SIGKILL.
 */
export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 25_000;

/**
 * Options for {@link registerGracefulShutdown}.
 */
export interface RegisterGracefulShutdownOptions {
  /**
   * Maximum time allowed for graceful teardown before `process.exit(1)`.
   *
   * Defaults to {@link DEFAULT_SHUTDOWN_TIMEOUT_MS} or `TEAM_HUB_SHUTDOWN_TIMEOUT_MS`.
   */
  timeoutMs?: number;

  /**
   * Closes the Fastify instance (defaults to `app.close`).
   */
  closeApp?: () => Promise<void>;

  /**
   * Disposes hub MCP client connections (defaults to {@link disposeHubMcpConnections}).
   */
  disposeMcp?: (options?: { timeoutMs?: number }) => Promise<void>;

  /**
   * Disconnects DB, Redis throttle, and notice bus (defaults to {@link disconnectAll}).
   */
  disconnectRuntime?: (ctx: RuntimeContext) => Promise<void>;

  /**
   * Exits the process (defaults to `process.exit`). Injectable for tests.
   */
  exitProcess?: (code: number) => void;

  /**
   * Registers a one-shot signal handler (defaults to `process.once`).
   */
  onSignal?: (signal: NodeJS.Signals, handler: () => void) => void;

  /**
   * Schedules the force-exit timer (defaults to `setTimeout`).
   */
  setForceExitTimer?: (callback: () => void, ms: number) => NodeJS.Timeout;

  /**
   * Clears the force-exit timer (defaults to `clearTimeout`).
   */
  clearForceExitTimer?: (timer: NodeJS.Timeout) => void;
}

/**
 * Resolves the shutdown force-exit timeout from options or the environment.
 *
 * @param timeoutMs - Explicit timeout override.
 * @returns Positive timeout in milliseconds.
 */
export function resolveShutdownTimeoutMs(timeoutMs?: number): number {
  if (typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs > 0) {
    return timeoutMs;
  }

  const fromEnv = process.env.TEAM_HUB_SHUTDOWN_TIMEOUT_MS;
  if (fromEnv) {
    const parsed = Number.parseInt(fromEnv, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return DEFAULT_SHUTDOWN_TIMEOUT_MS;
}

/**
 * Registers SIGINT and SIGTERM handlers that drain SSE, dispose MCP, and disconnect runtime resources.
 *
 * Shutdown is idempotent: a second signal is ignored while teardown is in progress.
 * A force-exit timer ensures the process does not hang past the orchestrator grace period.
 *
 * @param app - Running Fastify server to close.
 * @param ctx - Runtime context whose connections are closed after the HTTP server.
 * @param options - Optional timeout and test doubles.
 */
export function registerGracefulShutdown(
  app: FastifyInstance,
  ctx: RuntimeContext,
  options: RegisterGracefulShutdownOptions = {}
): void {
  const timeoutMs = resolveShutdownTimeoutMs(options.timeoutMs);
  const closeApp = options.closeApp ?? (() => app.close());
  const disposeMcp = options.disposeMcp ?? disposeHubMcpConnections;
  const disconnectRuntime = options.disconnectRuntime ?? disconnectAll;
  const exitProcess = options.exitProcess ?? ((code: number) => process.exit(code));
  const onSignal = options.onSignal ?? ((signal, handler) => process.once(signal, handler));
  const setForceExitTimer = options.setForceExitTimer ?? setTimeout;
  const clearForceExitTimer = options.clearForceExitTimer ?? clearTimeout;

  let shuttingDown = false;

  /**
   * Runs ordered teardown after the first termination signal.
   *
   * @param signal - Signal that triggered shutdown.
   */
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    beginShuttingDown();

    app.log.info(`Received ${signal}, shutting down.`);

    const forceExitTimer = setForceExitTimer(() => {
      app.log.error(`Graceful shutdown timed out after ${timeoutMs}ms; forcing exit.`);
      exitProcess(1);
    }, timeoutMs);

    try {
      await closeApp();
      // Leave headroom for MCP dispose within the overall force-exit budget.
      const mcpTimeoutMs = Math.max(1_000, Math.floor(timeoutMs / 5));
      await disposeMcp({ timeoutMs: mcpTimeoutMs });
      await disconnectRuntime(ctx);
      clearForceExitTimer(forceExitTimer);
      exitProcess(0);
    } catch (error) {
      clearForceExitTimer(forceExitTimer);
      const message = error instanceof Error ? error.message : String(error);
      app.log.error(`Graceful shutdown failed: ${message}`);
      exitProcess(1);
    }
  };

  /**
   * Forwards SIGINT to the shared shutdown handler.
   */
  onSignal('SIGINT', () => {
    void shutdown('SIGINT');
  });

  /**
   * Forwards SIGTERM to the shared shutdown handler.
   */
  onSignal('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}
