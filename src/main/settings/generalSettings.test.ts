import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LocalDatabase } from '#/main/storage/LocalDatabase';
import {
  clearLocalDatabaseForTesting,
  setLocalDatabaseForTesting
} from '#/main/storage/localDatabaseInstance';
import {
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_PROXY_SETTINGS,
  getGeneralSettings,
  setGeneralSettings
} from '#/main/settings/generalSettings';

describe('generalSettings', () => {
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

  it('returns defaults when unset', () => {
    expect(getGeneralSettings()).toEqual(DEFAULT_GENERAL_SETTINGS);
  });

  it('normalizes invalid proxy protocol and port', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      proxy: {
        enabled: true,
        protocol: 'socks5' as 'http',
        host: ' proxy.local ',
        port: 0,
        authEnabled: true,
        username: 'user',
        password: 'secret'
      }
    });

    expect(getGeneralSettings().proxy).toEqual({
      enabled: true,
      protocol: 'http',
      host: 'proxy.local',
      port: DEFAULT_PROXY_SETTINGS.port,
      authEnabled: true,
      username: 'user',
      password: 'secret'
    });
  });

  it('preserves valid https proxy settings', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      proxy: {
        enabled: true,
        protocol: 'https',
        host: 'secure-proxy.example.com',
        port: 8443,
        authEnabled: false,
        username: '',
        password: ''
      }
    });

    expect(getGeneralSettings().proxy).toEqual({
      enabled: true,
      protocol: 'https',
      host: 'secure-proxy.example.com',
      port: 8443,
      authEnabled: false,
      username: '',
      password: ''
    });
  });
});
