import { TeamHubClientError } from './TeamHubClientError.js';

/**
 * Returns whether a Team Hub error indicates the server does not expose discussions.
 *
 * Older hub deployments return 404 for entity discussion routes before the
 * communication feature shipped.
 *
 * @param err - Error thrown while reading or writing hub-backed discussions.
 */
export function isTeamHubCommunicationUnsupportedError(err: unknown): boolean {
  return (
    err instanceof TeamHubClientError &&
    err.status === 404 &&
    err.method === 'GET' &&
    (err.path.endsWith('/discussions') || err.path.startsWith('/discussion-comments/'))
  );
}
