import { TeamHubClientError } from './TeamHubClientError.js';

/**
 * Returns whether a Team Hub error indicates the server does not expose snippets.
 *
 * Older hub deployments return 404 for the collection-level `/snippets` route
 * (both `GET` listing and `POST` create) before the feature shipped. Id-scoped
 * routes such as `/snippets/:id` are excluded because a 404 there means the
 * snippet is missing, not that the feature is unavailable.
 *
 * @param err - Error thrown while reading or writing hub-backed snippets.
 */
export function isTeamHubSnippetsUnsupportedError(err: unknown): boolean {
  return (
    err instanceof TeamHubClientError &&
    err.status === 404 &&
    (err.method === 'GET' || err.method === 'POST') &&
    err.path === '/snippets'
  );
}
