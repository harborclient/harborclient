import { TeamHubClientError } from '@harborclient/team-hub-api';

/**
 * Detects older Team Hubs that do not expose live-page routes.
 *
 * @param err - Error raised by a live-page API call.
 */
export function isTeamHubLivePagesUnsupportedError(err: unknown): boolean {
  return (
    err instanceof TeamHubClientError &&
    err.status === 404 &&
    (err.path === '/live-pages' || err.path.startsWith('/live-pages/'))
  );
}
