import { describe, expect, it } from 'vitest';
import { TeamHubClientError } from './TeamHubClientError.js';
import {
  TEAM_HUB_DEVICE_ENROLLMENT_DISABLED_MESSAGE,
  isTeamHubDeviceEnrollmentDisabledError
} from './isTeamHubDeviceEnrollmentDisabledError.js';

describe('isTeamHubDeviceEnrollmentDisabledError', () => {
  it('matches the E2EE-disabled device enrollment 404', () => {
    expect(
      isTeamHubDeviceEnrollmentDisabledError(
        new TeamHubClientError(TEAM_HUB_DEVICE_ENROLLMENT_DISABLED_MESSAGE, {
          status: 404,
          method: 'GET',
          path: '/admin/device-keys'
        })
      )
    ).toBe(true);
  });

  it('rejects unrelated 404 responses', () => {
    expect(
      isTeamHubDeviceEnrollmentDisabledError(
        new TeamHubClientError('Device not found', {
          status: 404,
          method: 'GET',
          path: '/admin/device-keys'
        })
      )
    ).toBe(false);
  });
});
