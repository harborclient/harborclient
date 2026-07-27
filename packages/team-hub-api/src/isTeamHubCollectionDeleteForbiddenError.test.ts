import { describe, expect, it } from 'vitest';
import { isTeamHubCollectionDeleteForbiddenError } from './isTeamHubCollectionDeleteForbiddenError.js';
import { TeamHubClientError } from './TeamHubClientError.js';

describe('isTeamHubCollectionDeleteForbiddenError', () => {
  it('returns true for a 403 DELETE /collections/:id TeamHubClientError', () => {
    const err = new TeamHubClientError('Forbidden', {
      status: 403,
      method: 'DELETE',
      path: '/collections/550e8400-e29b-41d4-a716-446655440000'
    });

    expect(isTeamHubCollectionDeleteForbiddenError(err)).toBe(true);
  });

  it('returns false for other TeamHubClientError statuses', () => {
    const err = new TeamHubClientError('Internal Server Error', {
      status: 500,
      method: 'DELETE',
      path: '/collections/550e8400-e29b-41d4-a716-446655440000'
    });

    expect(isTeamHubCollectionDeleteForbiddenError(err)).toBe(false);
  });

  it('returns false for non-TeamHubClientError values', () => {
    expect(isTeamHubCollectionDeleteForbiddenError(new Error('Forbidden'))).toBe(false);
  });
});
