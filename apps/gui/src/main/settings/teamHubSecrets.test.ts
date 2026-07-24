import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LocalDatabase } from '#/main/storage/LocalDatabase';
import {
  clearLocalDatabaseForTesting,
  setLocalDatabaseForTesting
} from '#/main/storage/localDatabaseInstance';
import {
  deleteTeamHubToken,
  getTeamHubToken,
  listTeamHubSecretIds,
  storeTeamHubToken
} from './teamHubSecrets';

describe('teamHubSecrets', () => {
  let settingsStore: Record<string, string>;

  beforeEach(() => {
    settingsStore = {};
    const database = {
      getSetting: (key: string) => settingsStore[key],
      setSetting: (key: string, value: string) => {
        settingsStore[key] = value;
      }
    } as LocalDatabase;
    setLocalDatabaseForTesting(database);
  });

  afterEach(() => {
    clearLocalDatabaseForTesting();
  });

  it('stores and retrieves a team hub bearer token', () => {
    storeTeamHubToken('hub-1', 'hbk_test_secret');
    expect(getTeamHubToken('hub-1')).toBe('hbk_test_secret');
    expect(listTeamHubSecretIds()).toEqual(['hub-1']);
  });

  it('deletes a stored team hub bearer token', () => {
    storeTeamHubToken('hub-1', 'hbk_test_secret');
    deleteTeamHubToken('hub-1');
    expect(getTeamHubToken('hub-1')).toBeUndefined();
    expect(listTeamHubSecretIds()).toEqual([]);
  });

  it('returns undefined for unknown hub ids', () => {
    expect(getTeamHubToken('missing')).toBeUndefined();
  });
});
