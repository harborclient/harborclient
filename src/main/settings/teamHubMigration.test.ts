import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LocalRegistry } from '#/main/db/LocalRegistry';
import {
  clearLocalRegistryForTesting,
  setLocalRegistryForTesting
} from '#/main/db/localRegistryInstance';
import { migrateTeamHubSettings } from '#/main/settings/teamHubMigration';

describe('teamHubMigration', () => {
  let settingsStore: Record<string, string>;
  let userDataPath: string;

  beforeEach(() => {
    settingsStore = {};
    userDataPath = mkdtempSync(join(tmpdir(), 'team-hub-migration-'));

    const registry = {
      getSetting: (key: string) => settingsStore[key],
      setSetting: (key: string, value: string) => {
        settingsStore[key] = value;
      },
      listSettingKeysWithPrefix: (prefix: string) =>
        Object.keys(settingsStore).filter((key) => key.startsWith(prefix))
    } as LocalRegistry;

    setLocalRegistryForTesting(registry);
  });

  afterEach(() => {
    clearLocalRegistryForTesting();
  });

  it('copies legacy serviceHubs into teamHubs when teamHubs is unset', () => {
    const legacyValue = JSON.stringify([
      { id: 'hub-1', name: 'Team Hub', baseUrl: 'http://127.0.0.1:8788', token: 'hbk_test' }
    ]);
    settingsStore.serviceHubs = legacyValue;

    migrateTeamHubSettings(
      {
        getSetting: (key) => settingsStore[key],
        setSetting: (key, value) => {
          settingsStore[key] = value;
        },
        listSettingKeysWithPrefix: (prefix) =>
          Object.keys(settingsStore).filter((key) => key.startsWith(prefix))
      } as LocalRegistry,
      userDataPath
    );

    expect(settingsStore.teamHubs).toBe(legacyValue);
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
      } as LocalRegistry,
      userDataPath
    );

    expect(settingsStore['teamHubDetached:hub-1']).toBe(JSON.stringify(['collection-uuid']));
    expect(settingsStore['serviceHubDetached:hub-1']).toBe('');
    expect(existsSync(join(userDataPath, 'team-hub-hub-1.db'))).toBe(true);
    expect(existsSync(join(userDataPath, 'service-hub-hub-1.db'))).toBe(false);
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
      } as LocalRegistry,
      userDataPath
    );

    expect(JSON.parse(settingsStore.teamHubs ?? '[]')).toEqual([
      { id: 'hub-1', name: 'Existing', baseUrl: 'http://127.0.0.1:8788', token: 'hbk_test' }
    ]);
    expect(settingsStore.serviceHubs).toBe(
      JSON.stringify([
        { id: 'legacy', name: 'Legacy', baseUrl: 'http://127.0.0.1:8789', token: 'hbk_old' }
      ])
    );
  });
});
