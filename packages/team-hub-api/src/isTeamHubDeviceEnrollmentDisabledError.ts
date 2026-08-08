import { TeamHubClientError } from './TeamHubClientError.js';

/**
 * Message returned by Team Hub when device routes are gated behind discussion E2EE.
 */
export const TEAM_HUB_DEVICE_ENROLLMENT_DISABLED_MESSAGE =
  'Device enrollment is only available on Team Hubs with discussion E2EE enabled.';

/**
 * Returns whether a Team Hub error means device enrollment is unavailable because
 * discussion E2EE is disabled on the hub.
 *
 * Plaintext hubs intentionally return 404 for device routes; clients should treat
 * that as an expected unavailable feature, not an operator-facing failure.
 *
 * @param err - Error thrown while listing or mutating device key enrollments.
 */
export function isTeamHubDeviceEnrollmentDisabledError(err: unknown): boolean {
  return (
    err instanceof TeamHubClientError &&
    err.status === 404 &&
    err.message === TEAM_HUB_DEVICE_ENROLLMENT_DISABLED_MESSAGE
  );
}
