import { describe, expect, it } from 'vitest';
import { TeamHubClientError } from './TeamHubClientError.js';
import { isTeamHubNoticeStreamUnsupportedError } from './isTeamHubNoticeStreamUnsupportedError.js';

describe('isTeamHubNoticeStreamUnsupportedError', () => {
  it('returns true for 404 notice stream responses', () => {
    expect(
      isTeamHubNoticeStreamUnsupportedError(
        new TeamHubClientError('Not found', {
          status: 404,
          method: 'GET',
          path: '/notices/stream'
        })
      )
    ).toBe(true);
  });

  it('returns false for other failures', () => {
    expect(
      isTeamHubNoticeStreamUnsupportedError(
        new TeamHubClientError('Unauthorized', {
          status: 401,
          method: 'GET',
          path: '/notices/stream'
        })
      )
    ).toBe(false);
  });
});
