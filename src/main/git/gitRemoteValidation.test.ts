import { beforeEach, describe, expect, it, vi } from 'vitest';

const listServerRefs = vi.hoisted(() => vi.fn());
const probeGitHubRepoAccess = vi.hoisted(() => vi.fn());

vi.mock('isomorphic-git', () => ({
  listServerRefs
}));

vi.mock('isomorphic-git/http/node', () => ({
  default: {}
}));

vi.mock('./githubRepoAccess', () => ({
  probeGitHubRepoAccess
}));

import { missingRemoteBranchMessage, validateRemoteCredentials } from './gitRemoteValidation';

/**
 * Builds a fake onAuth callback used by validation tests.
 */
function mockOnAuth(): () => Promise<{ username: string; password: string }> {
  return async () => ({ username: 'oauth2', password: 'token' });
}

describe('validateRemoteCredentials', () => {
  beforeEach(() => {
    listServerRefs.mockReset();
    probeGitHubRepoAccess.mockReset();
  });

  it('uses the GitHub REST probe for github.com URLs', async () => {
    probeGitHubRepoAccess.mockResolvedValue({
      owner: 'org',
      repo: 'empty',
      canPush: true,
      canPull: true,
      emptyRemote: true,
      defaultBranch: null
    });

    await expect(
      validateRemoteCredentials('https://github.com/org/empty.git', 'main', mockOnAuth(), {
        githubLogin: 'octocat'
      })
    ).resolves.toEqual({ emptyRemote: true, canPush: true });

    expect(probeGitHubRepoAccess).toHaveBeenCalledWith('https://github.com/org/empty.git', 'token');
    expect(listServerRefs).not.toHaveBeenCalled();
  });

  it('formats GitHub 404s with login and owner diagnostics', async () => {
    const err = Object.assign(new Error('HTTP Error: 404 Not Found'), {
      data: { statusCode: 404 },
      owner: 'harborclient'
    });
    probeGitHubRepoAccess.mockRejectedValue(err);

    await expect(
      validateRemoteCredentials(
        'https://github.com/harborclient/missing.git',
        'main',
        mockOnAuth(),
        { githubLogin: 'octocat' }
      )
    ).rejects.toThrow(/signed in as octocat/);

    await expect(
      validateRemoteCredentials(
        'https://github.com/harborclient/missing.git',
        'main',
        mockOnAuth(),
        { githubLogin: 'octocat' }
      )
    ).rejects.toThrow(/orgs\/harborclient\/sso/);
  });

  it('reports canPush false from the REST probe without throwing', async () => {
    probeGitHubRepoAccess.mockResolvedValue({
      owner: 'org',
      repo: 'repo',
      canPush: false,
      canPull: true,
      emptyRemote: false,
      defaultBranch: 'main'
    });

    await expect(
      validateRemoteCredentials('https://github.com/org/repo.git', 'main', mockOnAuth())
    ).resolves.toEqual({ emptyRemote: false, canPush: false });
  });

  it('succeeds with emptyRemote true when a non-GitHub remote has no refs', async () => {
    listServerRefs.mockResolvedValue([]);

    await expect(
      validateRemoteCredentials('https://gitlab.com/org/empty.git', 'main', mockOnAuth())
    ).resolves.toEqual({ emptyRemote: true });

    expect(probeGitHubRepoAccess).not.toHaveBeenCalled();
  });

  it('succeeds with emptyRemote false when a non-GitHub branch exists', async () => {
    listServerRefs.mockResolvedValue([
      { ref: 'refs/heads/main', oid: 'abc123' },
      { ref: 'HEAD', oid: 'abc123', target: 'refs/heads/main' }
    ]);

    await expect(
      validateRemoteCredentials('https://gitlab.com/org/repo.git', 'main', mockOnAuth())
    ).resolves.toEqual({ emptyRemote: false });
  });

  it('matches bare branch names returned by a non-GitHub server', async () => {
    listServerRefs.mockResolvedValue([{ ref: 'main', oid: 'abc123' }]);

    await expect(
      validateRemoteCredentials('https://gitlab.com/org/repo.git', 'main', mockOnAuth())
    ).resolves.toEqual({ emptyRemote: false });
  });

  it('throws a branch-not-found message when non-GitHub refs exist but the branch is missing', async () => {
    listServerRefs.mockResolvedValue([{ ref: 'refs/heads/develop', oid: 'abc123' }]);

    await expect(
      validateRemoteCredentials('https://gitlab.com/org/repo.git', 'main', mockOnAuth())
    ).rejects.toThrow(missingRemoteBranchMessage('main'));
  });

  it('formats HTTP 404 errors for non-GitHub remotes', async () => {
    const err = Object.assign(new Error('HTTP Error: 404 Not Found'), {
      code: 'HttpError',
      data: { statusCode: 404 }
    });
    listServerRefs.mockRejectedValue(err);

    await expect(
      validateRemoteCredentials('https://gitlab.com/org/missing.git', 'main', mockOnAuth())
    ).rejects.toThrow(/repository not found/i);
  });
});
