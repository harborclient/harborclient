/** Matches RoutingStorage errors when a provider backend is not mounted. */
const UNAVAILABLE_CONNECTION_PATTERN = /^Database connection ".*" is unavailable\.$/;

/**
 * User-facing message when snippet mutations target an offline Team Hub backend.
 */
export const OFFLINE_TEAM_HUB_SNIPPET_ERROR =
  'The Team Hub storing this snippet is currently offline. Please ensure it is running and try again.';

/**
 * Rewrites generic unavailable-connection IPC errors into a clearer Team Hub message.
 *
 * @param err - Error thrown by snippet create/update/move/delete IPC handlers.
 * @returns The original error or a rewritten offline Team Hub error.
 */
export function normalizeOfflineTeamHubSnippetError(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  if (UNAVAILABLE_CONNECTION_PATTERN.test(message)) {
    return new Error(OFFLINE_TEAM_HUB_SNIPPET_ERROR, { cause: err });
  }

  return err instanceof Error ? err : new Error(message);
}

/**
 * Runs a snippet IPC call and rewrites offline Team Hub backend errors for the UI.
 *
 * @param operation - Snippet mutation that may reject with an unavailable backend error.
 * @returns The resolved IPC result.
 * @throws A user-facing error when the Team Hub backend is unavailable.
 */
export async function withOfflineTeamHubSnippetError<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (err) {
    throw normalizeOfflineTeamHubSnippetError(err);
  }
}
