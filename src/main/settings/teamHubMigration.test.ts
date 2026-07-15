import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LocalDatabase } from '#/main/storage/LocalDatabase';
import {
  clearLocalDatabaseForTesting,
  setLocalDatabaseForTesting
} from '#/main/storage/localDatabaseInstance';
import { migrateTeamHubSettings } from './teamHubMigration';

describe('teamHubMigration', () => {
  let settingsStore: Record<string, string>;
  let userDataPath: string;

  beforeEach(() => {
    settingsStore = {};
    userDataPath = mkdtempSync(join(tmpdir(), 'team-hub-migration-'));

    const database = {
      getSetting: (key: string) => settingsStore[key],
      setSetting: (key: string, value: string) => {
        settingsStore[key] = value;
      },
      listSettingKeysWithPrefix: (prefix: string) =>
        Object.keys(settingsStore).filter((key) => key.startsWith(prefix))
    } as LocalDatabase;

    setLocalDatabaseForTesting(database);
  });

  afterEach(() => {
    clearLocalDatabaseForTesting();
  });

  it('copies legacy serviceHubs into teamHubs when teamHubs is unset', () => {
    settingsStore.serviceHubs = JSON.stringify([
      { id: 'hub-1', name: 'Team Hub', baseUrl: 'http://127.0.0.1:8788', token: 'hbk_test' }
    ]);

    migrateTeamHubSettings(
      {
        getSetting: (key) => settingsStore[key],
        setSetting: (key, value) => {
          settingsStore[key] = value;
        },
        listSettingKeysWithPrefix: (prefix) =>
          Object.keys(settingsStore).filter((key) => key.startsWith(prefix))
      } as LocalDatabase,
      userDataPath
    );

    expect(JSON.parse(settingsStore.teamHubs ?? '[]')).toEqual([
      { id: 'hub-1', name: 'Team Hub', baseUrl: 'http://127.0.0.1:8788' }
    ]);
    expect(settingsStore.teamHubSecrets).toBeTruthy();
    expect(JSON.parse(settingsStore.teamHubSecrets ?? '{}')).toHaveProperty('hub-1');
    expect(settingsStore.serviceHubs).toBe('');
  });

  it('renames legacy detached keys and id-map files', () => {
    settingsStore['serviceHubDetached:hub-1'] = JSON.stringify(['collection-uuid']);
    mkdirSync(userDataPath, { recursive: true });
    writeFileSync(join(userDataPath, 'service-hub-hub-1.db'), 'sqlite');

    migrateTeamHubSettings(
      {
        getSetting: (key) => settingsStore[key],
        setSetting: (key, value) => {
          settingsStore[key] = value;
        },
        listSettingKeysWithPrefix: (prefix) =>
          Object.keys(settingsStore).filter((key) => key.startsWith(prefix))
      } as LocalDatabase,
      userDataPath
    );

    expect(settingsStore['teamHubDetached:hub-1']).toBe(JSON.stringify(['collection-uuid']));
    expect(settingsStore['serviceHubDetached:hub-1']).toBe('');
    expect(existsSync(join(userDataPath, 'team-hub-hub-1.db'))).toBe(true);
    expect(existsSync(join(userDataPath, 'service-hub-hub-1.db'))).toBe(false);
  });

  it('moves inline bearer tokens into encrypted sidecar storage', () => {
    settingsStore.teamHubs = JSON.stringify([
      { id: 'hub-1', name: 'Team Hub', baseUrl: 'http://127.0.0.1:8788', token: 'hbk_test' }
    ]);

    migrateTeamHubSettings(
      {
        getSetting: (key) => settingsStore[key],
        setSetting: (key, value) => {
          settingsStore[key] = value;
        },
        listSettingKeysWithPrefix: (prefix) =>
          Object.keys(settingsStore).filter((key) => key.startsWith(prefix))
      } as LocalDatabase,
      userDataPath
    );

    expect(JSON.parse(settingsStore.teamHubs ?? '[]')).toEqual([
      { id: 'hub-1', name: 'Team Hub', baseUrl: 'http://127.0.0.1:8788' }
    ]);
    expect(settingsStore.teamHubSecrets).toBeTruthy();
    expect(JSON.parse(settingsStore.teamHubSecrets ?? '{}')).toHaveProperty('hub-1');
  });

  it('is idempotent when teamHubs is already populated', () => {
    settingsStore.teamHubs = JSON.stringify([
      { id: 'hub-1', name: 'Existing', baseUrl: 'http://127.0.0.1:8788', token: 'hbk_test' }
    ]);
    settingsStore.serviceHubs = JSON.stringify([
      { id: 'legacy', name: 'Legacy', baseUrl: 'http://127.0.0.1:8789', token: 'hbk_old' }
    ]);

    migrateTeamHubSettings(
      {
        getSetting: (key) => settingsStore[key],
        setSetting: (key, value) => {
          settingsStore[key] = value;
        },
        listSettingKeysWithPrefix: (prefix) =>
          Object.keys(settingsStore).filter((key) => key.startsWith(prefix))
      } as LocalDatabase,
      userDataPath
    );

    expect(JSON.parse(settingsStore.teamHubs ?? '[]')).toEqual([
      { id: 'hub-1', name: 'Existing', baseUrl: 'http://127.0.0.1:8788' }
    ]);
    expect(settingsStore.teamHubSecrets).toBeTruthy();
    expect(JSON.parse(settingsStore.teamHubSecrets ?? '{}')).toHaveProperty('hub-1');
    expect(settingsStore.serviceHubs).toBe(
      JSON.stringify([
        { id: 'legacy', name: 'Legacy', baseUrl: 'http://127.0.0.1:8789', token: 'hbk_old' }
      ])
    );
  });
});
