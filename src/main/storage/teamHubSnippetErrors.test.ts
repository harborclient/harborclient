import { describe, expect, it } from 'vitest';
import type { MountedBackend } from './routingInternals';
import { rethrowTeamHubSnippetCreateError } from './teamHubSnippetErrors';
import { TeamHubClientError } from '@harborclient/team-hub-api';

/**
 * Builds a minimal mounted team hub backend for snippet error tests.
 *
 * @param overrides - Optional backend field overrides.
 */
function teamHubBackend(overrides: Partial<MountedBackend> = {}): MountedBackend {
  return {
    slot: 1,
    connectionId: 'hub-a',
    connectionName: 'Local',
    connectionType: 'team-hub',
    teamHubBaseUrl: 'http://127.0.0.1:8788',
    db: {} as MountedBackend['db'],
    ...overrides
  };
}

describe('rethrowTeamHubSnippetCreateError', () => {
  it('describes missing snippet routes with the team hub base URL', () => {
    const backend = teamHubBackend();

    expect(() =>
      rethrowTeamHubSnippetCreateError(
        backend,
        new TeamHubClientError('Not Found', {
          status: 404,
          method: 'POST',
          path: '/snippets'
        })
      )
    ).toThrow(/"Local" \(Team Hub at http:\/\/127\.0\.0\.1:8788\).*snippet storage routes/);
  });

  it('describes forbidden snippet create as a permissions problem', () => {
    const backend = teamHubBackend();

    expect(() =>
      rethrowTeamHubSnippetCreateError(
        backend,
        new TeamHubClientError('Forbidden', {
          status: 403,
          method: 'POST',
          path: '/snippets'
        })
      )
    ).toThrow(/snippet create access/);
  });

  it('rethrows database backend errors unchanged', () => {
    const backend = teamHubBackend({
      connectionType: 'sqlite',
      connectionName: 'Local',
      teamHubBaseUrl: undefined
    });
    const err = new Error('disk full');

    expect(() => rethrowTeamHubSnippetCreateError(backend, err)).toThrow(err);
  });
});
