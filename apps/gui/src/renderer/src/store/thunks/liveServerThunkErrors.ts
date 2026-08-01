/** Matches RoutingStorage errors when a provider backend is not mounted. */
const UNAVAILABLE_CONNECTION_PATTERN = /^Database connection ".*" is unavailable\.$/;

/**
 * Rewrites unavailable-provider errors with the entity name used by the UI.
 *
 * @param err - Error thrown by a routed mutation.
 * @param entityLabel - Human-readable entity type.
 * @returns The original error or a clearer offline Team Hub error.
 */
function normalizeOfflineTeamHubError(err: unknown, entityLabel: string): Error {
  const message = err instanceof Error ? err.message : String(err);
  if (UNAVAILABLE_CONNECTION_PATTERN.test(message)) {
    return new Error(
      `The Team Hub storing this ${entityLabel} is currently offline. Please ensure it is running and try again.`,
      { cause: err }
    );
  }
  return err instanceof Error ? err : new Error(message);
}

/**
 * Runs a live-server mutation and rewrites unavailable Team Hub errors.
 *
 * @param operation - Routed live-server operation.
 * @returns The resolved operation result.
 * @throws A user-facing error when the Team Hub backend is unavailable.
 */
export async function withOfflineTeamHubLiveServerError<T>(
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } catch (err) {
    throw normalizeOfflineTeamHubError(err, 'live server');
  }
}

/**
 * Runs a live-page mutation and rewrites unavailable Team Hub errors.
 *
 * @param operation - Routed live-page operation.
 * @returns The resolved operation result.
 * @throws A user-facing error when the Team Hub backend is unavailable.
 */
export async function withOfflineTeamHubLivePageError<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (err) {
    throw normalizeOfflineTeamHubError(err, 'live page');
  }
}
