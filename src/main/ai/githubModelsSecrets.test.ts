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

import {
  deleteGithubModelsAuth,
  getGithubModelsAccessToken,
  getGithubModelsLogin,
  getGithubModelsRefreshToken,
  getGithubModelsTokenExpiresAt,
  hasGithubModelsAccessToken,
  storeGithubModelsTokens
} from './githubModelsSecrets';

describe('githubModelsSecrets', () => {
  beforeEach(() => {
    settings.clear();
  });

  it('stores and reads GitHub Models tokens and metadata', () => {
    storeGithubModelsTokens('access-token', 'refresh-token', '2099-01-01T00:00:00.000Z', 'octocat');

    expect(hasGithubModelsAccessToken()).toBe(true);
    expect(getGithubModelsAccessToken()).toBe('access-token');
    expect(getGithubModelsRefreshToken()).toBe('refresh-token');
    expect(getGithubModelsTokenExpiresAt()).toBe('2099-01-01T00:00:00.000Z');
    expect(getGithubModelsLogin()).toBe('octocat');
  });

  it('deletes stored GitHub Models auth', () => {
    storeGithubModelsTokens('access-token');
    deleteGithubModelsAuth();

    expect(hasGithubModelsAccessToken()).toBe(false);
    expect(getGithubModelsAccessToken()).toBeUndefined();
  });
});
