import { afterEach, describe, expect, it, vi } from 'vitest';
import { probeGitHubRepoAccess } from './githubRepoAccess';

describe('probeGitHubRepoAccess', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * Stubs global fetch with a JSON response and optional response headers.
   *
   * @param status - HTTP status code.
   * @param body - JSON body returned to callers.
   * @param headers - Optional response headers keyed by lowercase name.
   */
  function stubFetch(status: number, body: unknown, headers: Record<string, string> = {}): void {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 404 ? 'Not Found' : 'OK',
        headers: {
          get: (name: string): string | null => headers[name.toLowerCase()] ?? null
        },
        json: async () => body
      }))
    );
  }

  it('returns null for non-GitHub repository URLs', async () => {
    await expect(
      probeGitHubRepoAccess('https://gitlab.com/org/repo.git', 'token')
    ).resolves.toBeNull();
  });

  it('reports emptyRemote and canPush for an empty repo with push permission', async () => {
    stubFetch(200, {
      size: 0,
      default_branch: null,
      permissions: { push: true, pull: true }
    });

    await expect(
      probeGitHubRepoAccess('https://github.com/harborclient/collection-test.git', 'token')
    ).resolves.toEqual({
      owner: 'harborclient',
      repo: 'collection-test',
      canPush: true,
      canPull: true,
      emptyRemote: true,
      defaultBranch: null
    });
  });

  it('reports canPush false when permissions lack push', async () => {
    stubFetch(200, {
      size: 12,
      default_branch: 'main',
      permissions: { push: false, pull: true }
    });

    const result = await probeGitHubRepoAccess('https://github.com/org/repo.git', 'token');
    expect(result).toMatchObject({
      canPush: false,
      canPull: true,
      emptyRemote: false,
      defaultBranch: 'main'
    });
  });

  it('throws a 404-shaped error with owner on repository not found', async () => {
    stubFetch(404, { message: 'Not Found' });

    await expect(
      probeGitHubRepoAccess('https://github.com/harborclient/missing.git', 'token')
    ).rejects.toMatchObject({
      data: { statusCode: 404 },
      owner: 'harborclient'
    });
  });

  it('throws a re-authorize message when the token is invalid', async () => {
    stubFetch(401, { message: 'Bad credentials' });

    await expect(probeGitHubRepoAccess('https://github.com/org/repo.git', 'token')).rejects.toThrow(
      /Re-authorize/
    );
  });

  it('throws an SSO-required message with the authorization URL on 403 with x-github-sso', async () => {
    stubFetch(
      403,
      { message: 'Resource protected by organization SAML enforcement.' },
      {
        'x-github-sso':
          'required; url=https://github.com/orgs/acme/sso?authorization_request=abc123'
      }
    );

    await expect(
      probeGitHubRepoAccess('https://github.com/acme/repo.git', 'token')
    ).rejects.toThrow(
      /SAML SSO authorization is required.*orgs\/acme\/sso\?authorization_request=abc123/s
    );
  });

  it('throws a rate-limit message with wait time on 403 with retry-after', async () => {
    stubFetch(403, { message: 'API rate limit exceeded' }, { 'retry-after': '60' });

    await expect(probeGitHubRepoAccess('https://github.com/org/repo.git', 'token')).rejects.toThrow(
      /rate limit reached.*60 seconds/s
    );
  });

  it('throws a rate-limit message on 403 with exhausted x-ratelimit-remaining', async () => {
    stubFetch(403, { message: 'API rate limit exceeded' }, { 'x-ratelimit-remaining': '0' });

    await expect(probeGitHubRepoAccess('https://github.com/org/repo.git', 'token')).rejects.toThrow(
      /rate limit reached/
    );
  });

  it('throws a forbidden message with org SSO hint on a generic 403', async () => {
    stubFetch(403, { message: 'Forbidden' });

    await expect(
      probeGitHubRepoAccess('https://github.com/acme/repo.git', 'token')
    ).rejects.toThrow(/403 Forbidden/);
  });

  it('throws an OAuth App restriction message from the 403 JSON body', async () => {
    stubFetch(403, {
      message:
        'Although you appear to have the correct authorization credentials, the `harborclient` organization has enabled OAuth App access restrictions that prevent your application from accessing this repository. Please contact your organization administrator to request access or create a fork of this repository.'
    });

    await expect(
      probeGitHubRepoAccess('https://github.com/harborclient/repo.git', 'token')
    ).rejects.toThrow(
      /harborclient organization.*restricts third-party OAuth apps.*Finish authentication/s
    );
  });
});
