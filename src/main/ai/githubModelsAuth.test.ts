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

import { getGithubModelsStatus, signOutGithubModels } from '#/main/ai/githubModelsAuth';
import { storeGithubModelsTokens } from '#/main/ai/githubModelsSecrets';

describe('githubModelsAuth', () => {
  beforeEach(() => {
    settings.clear();
  });

  it('reports disconnected status when no token is stored', () => {
    expect(getGithubModelsStatus()).toEqual({ connected: false });
  });

  it('reports connected status with login and expiry metadata', () => {
    storeGithubModelsTokens('access-token', 'refresh-token', '2099-01-01T00:00:00.000Z', 'octocat');

    expect(getGithubModelsStatus()).toEqual({
      connected: true,
      login: 'octocat',
      expiresAt: '2099-01-01T00:00:00.000Z'
    });
  });

  it('clears stored credentials on sign out', () => {
    storeGithubModelsTokens('access-token', 'refresh-token', '2099-01-01T00:00:00.000Z', 'octocat');

    signOutGithubModels();

    expect(getGithubModelsStatus()).toEqual({ connected: false });
  });
});
