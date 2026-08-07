import { TeamHubClientError } from './TeamHubClientError.js';

/**
 * Returns whether a Team Hub error indicates the server does not expose notices.
 *
 * Older hub deployments return 404 for notice routes before the notices feature
 * shipped.
 *
 * @param err - Error thrown while reading or writing hub-backed notices.
 */
export function isTeamHubNoticesUnsupportedError(err: unknown): boolean {
  return (
    err instanceof TeamHubClientError &&
    err.status === 404 &&
    (err.path === '/notices' ||
      err.path === '/notices/unread-count' ||
      err.path.startsWith('/notices/') ||
      err.path === '/me/notification-settings' ||
      err.path.startsWith('/discussion-threads/'))
  );
}
