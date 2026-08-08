/**
 * Cleanup callback for one open notice SSE connection.
 */
export type NoticeStreamCleanup = () => void;

/**
 * Open notice SSE streams registered for graceful shutdown.
 *
 * Hijacked Fastify replies are not tracked by `app.close()`, so open SSE
 * connections must be closed explicitly in a `preClose` hook.
 */
const openStreams = new Set<NoticeStreamCleanup>();

/**
 * Registers an open notice SSE stream so shutdown can close it.
 *
 * @param cleanup - Idempotent function that ends the stream and releases resources.
 * @returns Unregister function that removes the cleanup without invoking it.
 */
export function registerNoticeStream(cleanup: NoticeStreamCleanup): () => void {
  openStreams.add(cleanup);
  return () => {
    openStreams.delete(cleanup);
  };
}

/**
 * Closes every registered notice SSE stream.
 *
 * Safe to call multiple times. Each cleanup is expected to be idempotent.
 * Entries are removed before invocation so a cleanup that unregisters itself
 * does not double-delete mid-iteration.
 */
export function closeAllNoticeStreams(): void {
  const cleanups = [...openStreams];
  openStreams.clear();
  for (const cleanup of cleanups) {
    cleanup();
  }
}

/**
 * Returns how many notice SSE streams are currently registered.
 *
 * Used by tests and (later) observability metrics.
 *
 * @returns Count of open streams.
 */
export function getOpenNoticeStreamCount(): number {
  return openStreams.size;
}
