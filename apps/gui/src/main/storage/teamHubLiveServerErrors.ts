import { TeamHubClientError } from '@harborclient/team-hub-api';

/**
 * Detects older Team Hubs that do not expose live-server routes.
 *
 * @param err - Error raised by a live-server API call.
 */
export function isTeamHubLiveServersUnsupportedError(err: unknown): boolean {
  return (
    err instanceof TeamHubClientError &&
    err.status === 404 &&
    (err.path === '/live-servers' || err.path.startsWith('/live-servers/'))
  );
}
import type { MountedBackend } from './routingInternals';

/**
 * Rewrites Team Hub live-entity create failures with provider context.
 *
 * @param backend - Destination provider.
 * @param entityLabel - User-facing entity label.
 * @param err - Original provider error.
 * @throws A contextual error for Team Hub failures, or the original error.
 */
function rethrowCreateError(
  backend: MountedBackend,
  entityLabel: 'live server' | 'live page',
  err: unknown
): never {
  if (backend.connectionType !== 'team-hub' || !(err instanceof TeamHubClientError)) {
    throw err;
  }
  const target = `"${backend.connectionName}"`;
  if (err.status === 404) {
    throw new Error(
      `${target} does not support ${entityLabel} storage routes. Confirm the Team Hub URL and server version.`
    );
  }
  if (err.status === 403) {
    throw new Error(`${target} rejected ${entityLabel} creation for the current hub token.`);
  }
  throw new Error(`${target} ${entityLabel} create failed: ${err.message}`);
}

/**
 * Rewrites live-server create failures from Team Hub providers.
 *
 * @param backend - Destination provider.
 * @param err - Original provider error.
 */
export function rethrowTeamHubLiveServerCreateError(backend: MountedBackend, err: unknown): never {
  rethrowCreateError(backend, 'live server', err);
}

/**
 * Rewrites live-page create failures from Team Hub providers.
 *
 * @param backend - Destination provider.
 * @param err - Original provider error.
 */
export function rethrowTeamHubLivePageCreateError(backend: MountedBackend, err: unknown): never {
  rethrowCreateError(backend, 'live page', err);
}
