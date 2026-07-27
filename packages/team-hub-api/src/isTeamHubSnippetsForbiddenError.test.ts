import { describe, expect, it } from 'vitest';
import { isTeamHubSnippetsForbiddenError } from './isTeamHubSnippetsForbiddenError.js';
import { TeamHubClientError } from './TeamHubClientError.js';

describe('isTeamHubSnippetsForbiddenError', () => {
  it('returns true for POST /snippets 403 responses', () => {
    const err = new TeamHubClientError('Forbidden', {
      status: 403,
      method: 'POST',
      path: '/snippets'
    });

    expect(isTeamHubSnippetsForbiddenError(err)).toBe(true);
  });

  it('returns false for GET /snippets 403 responses', () => {
    const err = new TeamHubClientError('Forbidden', {
      status: 403,
      method: 'GET',
      path: '/snippets'
    });

    expect(isTeamHubSnippetsForbiddenError(err)).toBe(false);
  });

  it('returns false for non-client errors', () => {
    expect(isTeamHubSnippetsForbiddenError(new Error('Forbidden'))).toBe(false);
  });
});
