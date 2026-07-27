import { TeamHubClientError } from './TeamHubClientError.js';

/**
 * Returns whether a Team Hub error indicates the token may not create snippets.
 *
 * @param err - Error thrown while creating a hub-backed snippet on the server.
 */
export function isTeamHubSnippetsForbiddenError(err: unknown): boolean {
  return (
    err instanceof TeamHubClientError &&
    err.status === 403 &&
    err.method === 'POST' &&
    err.path === '/snippets'
  );
}
