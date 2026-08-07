/**
 * Returns whether a notice API failure should be handled silently in the UI.
 *
 * Older Team Hub servers and unreachable hubs should not trigger noisy toasts when
 * notice routes are unavailable.
 *
 * @param err - Error thrown while fetching or mutating notices.
 */
export function isTeamHubNoticesGracefulError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const normalized = message.toLowerCase();
  return (
    normalized.includes('404') ||
    normalized.includes('not found') ||
    normalized.includes('unsupported') ||
    normalized.includes('timed out') ||
    normalized.includes('network') ||
    normalized.includes('fetch failed') ||
    normalized.includes('connection not found')
  );
}
