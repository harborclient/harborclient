import { TeamHubClientError } from './TeamHubClientError.js';

/**
 * Returns whether a Team Hub error indicates the caller may not delete a collection.
 *
 * @param err - Error thrown while deleting a hub-backed collection on the server.
 */
export function isTeamHubCollectionDeleteForbiddenError(err: unknown): boolean {
  return (
    err instanceof TeamHubClientError &&
    err.status === 403 &&
    err.method === 'DELETE' &&
    err.path.startsWith('/collections/')
  );
}
