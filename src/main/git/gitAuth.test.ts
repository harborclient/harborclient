import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseConnection } from '#/shared/types';

const mockConnections: DatabaseConnection[] = [];

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

vi.mock('#/main/settings/databaseSettings', () => ({
  listDatabaseConnections: () => mockConnections,
  saveDatabaseConnection: (input: DatabaseConnection) => {
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
  storeGitOAuthTokens: vi.fn(),
  storeGitPat: vi.fn(),
  deleteGitSecrets: vi.fn()
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
  storeGitPat
} from '#/main/git/gitSecrets';
import {
  beginGitHubOAuth,
  finishGitHubOAuth,
  resolveGitAuth,
  revokeGitHubOAuth,
  saveGitPat
} from '#/main/git/gitAuth';
import { GITHUB_OAUTH_CLIENT_ID } from '#/main/git/githubOAuth';

describe('git auth resolver', () => {
  beforeEach(() => {
    mockConnections.length = 0;
    vi.mocked(getGitAccessToken).mockReturnValue('stored-pat');
    vi.mocked(getGitRefreshToken).mockReturnValue(undefined);
    startGitHubDeviceFlow.mockClear();
    refreshGitHubAccessToken.mockClear();
  });

  it('resolves PAT credentials from encrypted storage', async () => {
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

    const auth = await resolveGitAuth('git-1');
    expect(auth).toEqual({ username: 'token', password: 'stored-pat' });
  });

  it('stores a PAT and persists auth metadata', () => {
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

    saveGitPat('git-pat', 'my-user', '  secret-token  ');

    expect(storeGitPat).toHaveBeenCalledWith('git-pat', 'secret-token');
    const conn = mockConnections[0];
    expect(conn.type === 'git' && conn.settings.auth).toEqual({
      kind: 'pat',
      username: 'my-user'
    });
  });

  it('starts and completes GitHub device flow', async () => {
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
    expect(startGitHubDeviceFlow).toHaveBeenCalledWith('git-oauth', GITHUB_OAUTH_CLIENT_ID);

    await finishGitHubOAuth('git-oauth');
    const conn = mockConnections[0];
    expect(conn.type === 'git' && conn.settings.auth).toEqual({
      kind: 'oauth',
      provider: 'github'
    });
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

  it('passes a custom OAuth client id when configured on the connection', async () => {
    mockConnections.push({
      id: 'git-oauth-custom',
      name: 'Git OAuth Custom',
      type: 'git',
      settings: {
        repoPath: '/tmp/repo',
        url: 'https://github.com/example/repo.git',
        branch: 'main',
        subdir: '.harborclient',
        oauthClientId: '  org-client-id  ',
        auth: { kind: 'pat', username: 'token' }
      }
    });

    await beginGitHubOAuth('git-oauth-custom');
    expect(startGitHubDeviceFlow).toHaveBeenCalledWith('git-oauth-custom', 'org-client-id');
  });

  it('refreshes OAuth tokens with the connection client id', async () => {
    mockConnections.push({
      id: 'git-oauth-refresh',
      name: 'Git OAuth Refresh',
      type: 'git',
      settings: {
        repoPath: '/tmp/repo',
        url: 'https://github.com/example/repo.git',
        branch: 'main',
        subdir: '.harborclient',
        oauthClientId: 'org-client-id',
        auth: { kind: 'oauth', provider: 'github' }
      }
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

  it('revokes GitHub OAuth and resets auth metadata', async () => {
    mockConnections.push({
      id: 'git-oauth',
      name: 'Git OAuth',
      type: 'git',
      settings: {
        repoPath: '/tmp/repo',
        url: 'https://github.com/example/repo.git',
        branch: 'main',
        subdir: '.harborclient',
        oauthClientId: 'org-client-id',
        auth: { kind: 'oauth', provider: 'github' }
      }
    });

    revokeGitHubOAuth('git-oauth');

    expect(deleteGitSecrets).toHaveBeenCalledWith('git-oauth');
    const conn = mockConnections[0];
    expect(conn.type === 'git' && conn.settings.auth).toEqual({
      kind: 'pat',
      username: 'token'
    });
    expect(conn.type === 'git' && conn.settings.oauthClientId).toBe('org-client-id');
  });
});
