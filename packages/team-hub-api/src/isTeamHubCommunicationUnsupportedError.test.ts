import { describe, expect, it } from 'vitest';
import { TeamHubClientError } from './TeamHubClientError.js';
import { isTeamHubCommunicationUnsupportedError } from './isTeamHubCommunicationUnsupportedError.js';

describe('isTeamHubCommunicationUnsupportedError', () => {
  it('returns true for missing discussion list routes on older hubs', () => {
    expect(
      isTeamHubCommunicationUnsupportedError(
        new TeamHubClientError('Not found', {
          status: 404,
          method: 'GET',
          path: '/collections/abc/discussions'
        })
      )
    ).toBe(true);
  });

  it('returns false for unrelated 404 errors', () => {
    expect(
      isTeamHubCommunicationUnsupportedError(
        new TeamHubClientError('Not found', {
          status: 404,
          method: 'GET',
          path: '/requests/missing'
        })
      )
    ).toBe(false);
  });
});
