import { describe, expect, it } from 'vitest';
import { isTeamHubSnippetsUnsupportedError } from './isTeamHubSnippetsUnsupportedError.js';
import { TeamHubClientError } from './TeamHubClientError.js';

describe('isTeamHubSnippetsUnsupportedError', () => {
  it('returns true for GET /snippets 404 responses', () => {
    const err = new TeamHubClientError('Not Found', {
      status: 404,
      method: 'GET',
      path: '/snippets'
    });

    expect(isTeamHubSnippetsUnsupportedError(err)).toBe(true);
  });

  it('returns true for POST /snippets 404 responses', () => {
    const err = new TeamHubClientError('Not Found', {
      status: 404,
      method: 'POST',
      path: '/snippets'
    });

    expect(isTeamHubSnippetsUnsupportedError(err)).toBe(true);
  });

  it('returns false for id-scoped snippet routes', () => {
    const err = new TeamHubClientError('Not Found', {
      status: 404,
      method: 'DELETE',
      path: '/snippets/abc'
    });

    expect(isTeamHubSnippetsUnsupportedError(err)).toBe(false);
  });

  it('returns false for non-client errors', () => {
    expect(isTeamHubSnippetsUnsupportedError(new Error('Not Found'))).toBe(false);
  });
});
