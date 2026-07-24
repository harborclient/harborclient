import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitAuthMethod, StorageConnection } from '#/shared/types';

const mockConnections: StorageConnection[] = [];
const identityByHost = new Map<
  string,
  { host: string; auth: GitAuthMethod; oauthClientId?: string; githubLogin?: string }
>();

const { startGitHubDeviceFlow, completeGitHubDeviceFlow, refreshGitHubAccessToken } = vi.hoisted(
  () => ({
    startGitHubDeviceFlow: vi.fn(async () => ({
      userCode: 'ABCD-1234',
      verificationUri: 'https://github.com/login/device'
    })),
    completeGitHubDeviceFlow: vi.fn(async () => ({
      accessToken: 'oauth-token',
      refreshToken: 'refresh-token',
      expiresAt: '2099-01-01T00:00:00.000Z'
    })),
    refreshGitHubAccessToken: vi.fn()
  })
);

vi.mock('#/main/settings/storageSettings', () => ({
  listStorageConnections: () => mockConnections,
  saveStorageConnection: (input: StorageConnection) => {
    const index = mockConnections.findIndex((conn) => conn.id === input.id);
    if (index >= 0) {
      mockConnections[index] = input;
    } else {
      mockConnections.push(input);
    }
    return mockConnections;
  }
}));

vi.mock('#/main/git/gitSecrets', () => ({
  getGitAccessToken: vi.fn(() => 'stored-pat'),
  getGitRefreshToken: vi.fn(() => null),
  getGitTokenExpiresAt: vi.fn(() => null),
  hasGitAccessToken: vi.fn(() => true),
  storeGitOAuthTokens: vi.fn(),
  storeGitPat: vi.fn(),
  deleteGitSecrets: vi.fn()
}));

vi.mock('#/main/git/gitIdentities', () => ({
  getGitIdentity: (host: string) => identityByHost.get(host),
  persistGitIdentityAuth: (host: string, auth: GitAuthMethod) => {
    const existing = identityByHost.get(host);
    const next = {
      host,
      auth,
      oauthClientId: existing?.oauthClientId,
      githubLogin: existing?.githubLogin
    };
    identityByHost.set(host, next);
    return { ...next, hasCredentials: true };
  },
  persistGitIdentityLogin: (host: string, githubLogin: string | undefined) => {
    const existing = identityByHost.get(host);
    const auth: GitAuthMethod = existing?.auth ?? { kind: 'pat', username: 'token' };
    const next = {
      host,
      auth,
      oauthClientId: existing?.oauthClientId,
      githubLogin: githubLogin?.trim() || undefined
    };
    identityByHost.set(host, next);
    return { ...next, hasCredentials: true };
  },
  upsertGitIdentity: (host: string, patch: { auth: GitAuthMethod; oauthClientId?: string }) => {
    const existing = identityByHost.get(host);
    const next = {
      host,
      auth: patch.auth,
      oauthClientId: patch.oauthClientId ?? existing?.oauthClientId,
      githubLogin: existing?.githubLogin
    };
    identityByHost.set(host, next);
    return { ...next, hasCredentials: true };
  },
  deleteGitIdentity: (host: string) => {
    identityByHost.delete(host);
  },
  setGitIdentityOAuthClientId: (host: string, oauthClientId: string) => {
    const existing = identityByHost.get(host);
    const auth: GitAuthMethod = existing?.auth ?? { kind: 'pat', username: 'token' };
    const trimmed = oauthClientId.trim();
    const next = {
      host,
      auth,
      oauthClientId: trimmed || undefined,
      githubLogin: existing?.githubLogin
    };
    identityByHost.set(host, next);
    return { ...next, hasCredentials: true };
  },
  listGitIdentities: () =>
    [...identityByHost.values()].map((identity) => ({
      ...identity,
      hasCredentials: true
    }))
}));

vi.mock('#/main/git/githubOAuth', () => ({
  GITHUB_OAUTH_CLIENT_ID: 'builtin-client-id',
  startGitHubDeviceFlow,
  completeGitHubDeviceFlow,
  refreshGitHubAccessToken
}));

import {
  deleteGitSecrets,
  getGitAccessToken,
  getGitRefreshToken,
  storeGitOAuthTokens,
  storeGitPat
} from './gitSecrets';
import {
  beginGitHubOAuth,
  finishGitHubOAuth,
  resolveGitAuth,
  revokeGitHubOAuth,
  saveGitPat,
  saveHostPat
} from './gitAuth';
import { GITHUB_OAUTH_CLIENT_ID } from './githubOAuth';
import { upsertGitIdentity } from './gitIdentities';

describe('git auth resolver', () => {
  beforeEach(() => {
    mockConnections.length = 0;
    identityByHost.clear();
    vi.mocked(getGitAccessToken).mockReturnValue('stored-pat');
    vi.mocked(getGitRefreshToken).mockReturnValue(undefined);
    startGitHubDeviceFlow.mockClear();
    refreshGitHubAccessToken.mockClear();
    vi.mocked(storeGitOAuthTokens).mockClear();
    vi.mocked(storeGitPat).mockClear();
    vi.mocked(deleteGitSecrets).mockClear();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ login: 'octocat' }), { status: 200 })
    );
  });

  it('resolves PAT credentials from encrypted storage by host', async () => {
    mockConnections.push({
      id: 'git-1',
      name: 'Git',
      type: 'git',
      settings: {
        repoPath: '/tmp/repo',
        url: 'https://github.com/example/repo.git',
        branch: 'main',
        subdir: '.harborclient',
        auth: { kind: 'pat', username: 'token' }
      }
    });
    identityByHost.set('github.com', {
      host: 'github.com',
      auth: { kind: 'pat', username: 'my-user' }
    });

    const auth = await resolveGitAuth('git-1');
    expect(getGitAccessToken).toHaveBeenCalledWith('github.com');
    expect(auth).toEqual({ username: 'my-user', password: 'stored-pat' });
  });

  it('stores a PAT for a host and persists identity metadata', async () => {
    await saveHostPat('github.com', 'my-user', '  secret-token  ');

    expect(storeGitPat).toHaveBeenCalledWith('github.com', 'secret-token');
    expect(identityByHost.get('github.com')?.auth).toEqual({
      kind: 'pat',
      username: 'my-user'
    });
    expect(identityByHost.get('github.com')?.githubLogin).toBe('octocat');
  });

  it('stores a PAT for a connection by resolving its host', async () => {
    mockConnections.push({
      id: 'git-pat',
      name: 'Git PAT',
      type: 'git',
      settings: {
        repoPath: '/tmp/repo',
        url: 'https://github.com/example/repo.git',
        branch: 'main',
        subdir: '.harborclient',
        auth: { kind: 'oauth', provider: 'github' }
      }
    });

    await saveGitPat('git-pat', 'my-user', 'secret-token');

    expect(storeGitPat).toHaveBeenCalledWith('github.com', 'secret-token');
    expect(identityByHost.get('github.com')?.auth).toEqual({
      kind: 'pat',
      username: 'my-user'
    });
  });

  it('starts and completes GitHub device flow for a connection host', async () => {
    mockConnections.push({
      id: 'git-oauth',
      name: 'Git OAuth',
      type: 'git',
      settings: {
        repoPath: '/tmp/repo',
        url: 'https://github.com/example/repo.git',
        branch: 'main',
        subdir: '.harborclient',
        auth: { kind: 'pat', username: 'token' }
      }
    });

    const started = await beginGitHubOAuth('git-oauth');
    expect(started.userCode).toBe('ABCD-1234');
    expect(startGitHubDeviceFlow).toHaveBeenCalledWith('github.com', GITHUB_OAUTH_CLIENT_ID);

    await finishGitHubOAuth('git-oauth');
    expect(storeGitOAuthTokens).toHaveBeenCalledWith(
      'github.com',
      'oauth-token',
      'refresh-token',
      '2099-01-01T00:00:00.000Z'
    );
    expect(identityByHost.get('github.com')?.auth).toEqual({
      kind: 'oauth',
      provider: 'github'
    });
    expect(identityByHost.get('github.com')?.githubLogin).toBe('octocat');
  });

  it('rejects OAuth for non-github.com repository URLs', async () => {
    mockConnections.push({
      id: 'git-not-github',
      name: 'Not GitHub',
      type: 'git',
      settings: {
        repoPath: '/tmp/repo',
        url: 'https://notgithub.com/example/repo.git',
        branch: 'main',
        subdir: '.harborclient',
        auth: { kind: 'pat', username: 'token' }
      }
    });

    await expect(beginGitHubOAuth('git-not-github')).rejects.toThrow(
      'GitHub OAuth is only supported for github.com repository URLs.'
    );
    expect(startGitHubDeviceFlow).not.toHaveBeenCalled();
  });

  it('passes a custom OAuth client id when configured on the host identity', async () => {
    mockConnections.push({
      id: 'git-oauth-custom',
      name: 'Git OAuth Custom',
      type: 'git',
      settings: {
        repoPath: '/tmp/repo',
        url: 'https://github.com/example/repo.git',
        branch: 'main',
        subdir: '.harborclient',
        auth: { kind: 'pat', username: 'token' }
      }
    });
    upsertGitIdentity('github.com', {
      auth: { kind: 'pat', username: 'token' },
      oauthClientId: 'org-client-id'
    });

    await beginGitHubOAuth('git-oauth-custom');
    expect(startGitHubDeviceFlow).toHaveBeenCalledWith('github.com', 'org-client-id');
  });

  it('deduplicates concurrent OAuth refresh requests for the same host', async () => {
    mockConnections.push({
      id: 'git-oauth-concurrent',
      name: 'Git OAuth Concurrent',
      type: 'git',
      settings: {
        repoPath: '/tmp/repo',
        url: 'https://github.com/example/repo.git',
        branch: 'main',
        subdir: '.harborclient',
        auth: { kind: 'oauth', provider: 'github' }
      }
    });
    identityByHost.set('github.com', {
      host: 'github.com',
      auth: { kind: 'oauth', provider: 'github' }
    });

    vi.mocked(getGitAccessToken).mockReturnValue(undefined);
    vi.mocked(getGitRefreshToken).mockReturnValue('refresh-token');

    let resolveRefresh: (value: {
      accessToken: string;
      refreshToken: string;
      expiresAt: string;
    }) => void = () => {};
    const refreshDeferred = new Promise<{
      accessToken: string;
      refreshToken: string;
      expiresAt: string;
    }>((resolve) => {
      resolveRefresh = resolve;
    });
    refreshGitHubAccessToken.mockReturnValue(refreshDeferred);

    const first = resolveGitAuth('git-oauth-concurrent');
    const second = resolveGitAuth('git-oauth-concurrent');

    expect(refreshGitHubAccessToken).toHaveBeenCalledTimes(1);

    resolveRefresh({
      accessToken: 'new-token',
      refreshToken: 'rotated-refresh-token',
      expiresAt: '2099-01-01T00:00:00.000Z'
    });

    const [authA, authB] = await Promise.all([first, second]);
    expect(authA).toEqual({ username: 'oauth2', password: 'new-token' });
    expect(authB).toEqual({ username: 'oauth2', password: 'new-token' });
    expect(storeGitOAuthTokens).toHaveBeenCalledTimes(1);
    expect(refreshGitHubAccessToken).toHaveBeenCalledTimes(1);
  });

  it('refreshes OAuth tokens with the host identity client id', async () => {
    mockConnections.push({
      id: 'git-oauth-refresh',
      name: 'Git OAuth Refresh',
      type: 'git',
      settings: {
        repoPath: '/tmp/repo',
        url: 'https://github.com/example/repo.git',
        branch: 'main',
        subdir: '.harborclient',
        auth: { kind: 'oauth', provider: 'github' }
      }
    });
    upsertGitIdentity('github.com', {
      auth: { kind: 'oauth', provider: 'github' },
      oauthClientId: 'org-client-id'
    });

    vi.mocked(getGitAccessToken).mockReturnValue(undefined);
    vi.mocked(getGitRefreshToken).mockReturnValue('refresh-token');
    refreshGitHubAccessToken.mockResolvedValue({
      accessToken: 'new-token',
      refreshToken: 'refresh-token',
      expiresAt: '2099-01-01T00:00:00.000Z'
    });

    const auth = await resolveGitAuth('git-oauth-refresh');
    expect(refreshGitHubAccessToken).toHaveBeenCalledWith('refresh-token', 'org-client-id');
    expect(auth).toEqual({ username: 'oauth2', password: 'new-token' });
  });

  it('revokes GitHub OAuth for a host and resets identity metadata to PAT', async () => {
    mockConnections.push({
      id: 'git-oauth',
      name: 'Git OAuth',
      type: 'git',
      settings: {
        repoPath: '/tmp/repo',
        url: 'https://github.com/example/repo.git',
        branch: 'main',
        subdir: '.harborclient',
        auth: { kind: 'oauth', provider: 'github' }
      }
    });
    identityByHost.set('github.com', {
      host: 'github.com',
      auth: { kind: 'oauth', provider: 'github' },
      oauthClientId: 'org-client-id'
    });

    revokeGitHubOAuth('git-oauth');

    expect(deleteGitSecrets).toHaveBeenCalledWith('github.com');
    expect(identityByHost.get('github.com')?.auth).toEqual({
      kind: 'pat',
      username: 'token'
    });
    expect(identityByHost.get('github.com')?.oauthClientId).toBe('org-client-id');
  });
});
