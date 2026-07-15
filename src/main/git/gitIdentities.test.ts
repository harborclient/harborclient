import { beforeEach, describe, expect, it, vi } from 'vitest';

const settings = new Map<string, string>();

vi.mock('#/main/storage/localDatabaseInstance', () => ({
  getLocalDatabase: () => ({
    getSetting: (key: string) => settings.get(key) ?? null,
    setSetting: (key: string, value: string) => {
      settings.set(key, value);
    }
  })
}));

vi.mock('#/main/git/gitSecrets', () => ({
  hasGitAccessToken: vi.fn((host: string) => host === 'github.com')
}));

import {
  deleteGitIdentity,
  getGitIdentity,
  listGitIdentities,
  persistGitIdentityAuth,
  upsertGitIdentity
} from './gitIdentities';

describe('gitIdentities', () => {
  beforeEach(() => {
    settings.clear();
  });

  it('creates and lists host identities with credential flags', () => {
    upsertGitIdentity('github.com', { auth: { kind: 'pat', username: 'token' } });
    upsertGitIdentity('gitlab.com', { auth: { kind: 'pat', username: 'user' } });

    const identities = listGitIdentities();
    expect(identities).toEqual([
      {
        host: 'github.com',
        auth: { kind: 'pat', username: 'token' },
        hasCredentials: true
      },
      {
        host: 'gitlab.com',
        auth: { kind: 'pat', username: 'user' },
        hasCredentials: false
      }
    ]);
  });

  it('updates auth metadata without dropping oauth client id', () => {
    upsertGitIdentity('github.com', {
      auth: { kind: 'pat', username: 'token' },
      oauthClientId: 'org-client-id'
    });

    persistGitIdentityAuth('github.com', { kind: 'oauth', provider: 'github' });

    expect(getGitIdentity('github.com')).toEqual({
      host: 'github.com',
      auth: { kind: 'oauth', provider: 'github' },
      oauthClientId: 'org-client-id'
    });
  });

  it('removes identity metadata for a host', () => {
    upsertGitIdentity('github.com', { auth: { kind: 'pat', username: 'token' } });
    deleteGitIdentity('github.com');
    expect(getGitIdentity('github.com')).toBeUndefined();
  });
});
