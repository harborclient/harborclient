import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LocalDatabase } from '#/main/storage/LocalDatabase';
import {
  clearLocalDatabaseForTesting,
  setLocalDatabaseForTesting
} from '#/main/storage/localDatabaseInstance';
import {
  getTeamHubUserName,
  isTeamHubConnected,
  removeTeamHubConnectionState,
  setTeamHubConnected,
  setTeamHubUserName
} from './teamHubConnectionState';

describe('teamHubConnectionState', () => {
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

  it('defaults unknown hubs to connected', () => {
    expect(isTeamHubConnected('missing-hub')).toBe(true);
  });

  it('persists connected and disconnected flags', () => {
    setTeamHubConnected('hub-a', false);
    expect(isTeamHubConnected('hub-a')).toBe(false);

    setTeamHubConnected('hub-a', true);
    expect(isTeamHubConnected('hub-a')).toBe(true);
  });

  it('persists user names and preserves them across connect toggles', () => {
    setTeamHubUserName('hub-a', '  Sean  ');
    expect(getTeamHubUserName('hub-a')).toBe('Sean');

    setTeamHubConnected('hub-a', false);
    expect(getTeamHubUserName('hub-a')).toBe('Sean');
    expect(isTeamHubConnected('hub-a')).toBe(false);
  });

  it('ignores blank user names', () => {
    setTeamHubUserName('hub-a', '   ');
    expect(getTeamHubUserName('hub-a')).toBeUndefined();
  });

  it('removes connection state for a hub', () => {
    setTeamHubConnected('hub-a', false);
    setTeamHubUserName('hub-a', 'Sean');
    removeTeamHubConnectionState('hub-a');

    expect(isTeamHubConnected('hub-a')).toBe(true);
    expect(getTeamHubUserName('hub-a')).toBeUndefined();
  });
});
