/**
 * Process-level flag set when SIGINT/SIGTERM begins graceful shutdown.
 *
 * Kept outside Fastify so `/readyz` can reject new traffic immediately, before
 * `app.close()` finishes draining in-flight work.
 */
let shuttingDown = false;

/**
 * Marks the process as shutting down so readiness probes fail immediately.
 */
export function beginShuttingDown(): void {
  shuttingDown = true;
}

/**
 * Returns whether graceful shutdown has started.
 *
 * @returns True after the first SIGINT/SIGTERM is handled.
 */
export function isShuttingDown(): boolean {
  return shuttingDown;
}

/**
 * Resets shutdown state for unit tests.
 *
 * Not used by production code.
 */
export function resetShuttingDownForTests(): void {
  shuttingDown = false;
}
