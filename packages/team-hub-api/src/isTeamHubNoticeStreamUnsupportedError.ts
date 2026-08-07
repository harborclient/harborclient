import { TeamHubClientError } from './TeamHubClientError.js';

/**
 * Returns whether a Team Hub error indicates the server does not expose notice SSE.
 *
 * Older hub deployments return 404 for `/notices/stream` before notice push exists.
 *
 * @param err - Error thrown while opening a notice stream.
 */
export function isTeamHubNoticeStreamUnsupportedError(err: unknown): boolean {
  return err instanceof TeamHubClientError && err.status === 404 && err.path === '/notices/stream';
}
