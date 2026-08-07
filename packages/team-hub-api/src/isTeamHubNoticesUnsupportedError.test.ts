import { describe, expect, it } from 'vitest';
import { TeamHubClientError } from './TeamHubClientError.js';
import { isTeamHubNoticesUnsupportedError } from './isTeamHubNoticesUnsupportedError.js';

describe('isTeamHubNoticesUnsupportedError', () => {
  it('returns true for 404 notice list responses', () => {
    expect(
      isTeamHubNoticesUnsupportedError(
        new TeamHubClientError('Not found', { status: 404, method: 'GET', path: '/notices' })
      )
    ).toBe(true);
  });

  it('returns false for other Team Hub errors', () => {
    expect(
      isTeamHubNoticesUnsupportedError(
        new TeamHubClientError('Unauthorized', { status: 401, method: 'GET', path: '/notices' })
      )
    ).toBe(false);
  });
});
