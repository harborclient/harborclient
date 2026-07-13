import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StorageConnection } from '#/shared/types';

const settings = new Map<string, string>();
const mockConnections: StorageConnection[] = [];

vi.mock('#/main/storage/localDatabaseInstance', () => ({
  getLocalDatabase: () => ({
    getSetting: (key: string) => settings.get(key) ?? null,
    setSetting: (key: string, value: string) => {
      settings.set(key, value);
    }
  })
}));

vi.mock('#/main/settings/storageSettings', () => ({
  listStorageConnections: () => mockConnections
}));

import { encryptSecret } from '#/main/secrets/secretStorage';
import { getGitAccessToken, storeGitPat } from '#/main/git/gitSecrets';
import { getGitIdentity } from '#/main/git/gitIdentities';

describe('gitSecrets host migration', () => {
  beforeEach(() => {
    settings.clear();
    mockConnections.length = 0;
  });

  it('promotes legacy per-connection secrets to per-host storage on first access', () => {
    const legacySecret = {
      accessToken: encryptSecret('legacy-token')
    };
    settings.set(
      'gitConnectionSecrets',
      JSON.stringify({
        'conn-legacy': legacySecret
      })
    );

    mockConnections.push({
      id: 'conn-legacy',
      name: 'Legacy Git',
      type: 'git',
      settings: {
        repoPath: '/tmp/repo',
        url: 'https://github.com/example/repo.git',
        branch: 'main',
        subdir: '.harborclient',
        auth: { kind: 'pat', username: 'legacy-user' },
        oauthClientId: 'org-client-id'
      }
    });

    expect(getGitAccessToken('github.com')).toBe('legacy-token');
    expect(getGitAccessToken('conn-legacy')).toBeUndefined();

    const stored = JSON.parse(settings.get('gitConnectionSecrets') ?? '{}') as Record<
      string,
      unknown
    >;
    expect(stored['conn-legacy']).toBeUndefined();
    expect(stored['github.com']).toBeDefined();
    expect(settings.get('gitHostSecretsMigrated')).toBe('1');

    expect(getGitIdentity('github.com')?.auth).toEqual({
      kind: 'pat',
      username: 'legacy-user'
    });
    expect(getGitIdentity('github.com')?.oauthClientId).toBe('org-client-id');
  });

  it('stores new secrets by host key', () => {
    storeGitPat('gitlab.com', 'new-token');
    expect(getGitAccessToken('gitlab.com')).toBe('new-token');
  });
});
