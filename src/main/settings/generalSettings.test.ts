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

  it('normalizes stored global variables', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      globalVariables: [
        { key: 'baseUrl', value: 'https://api.example.com', defaultValue: '', share: false }
      ]
    });

    expect(getGeneralSettings().globalVariables).toEqual([
      { key: 'baseUrl', value: 'https://api.example.com', defaultValue: '', share: false }
    ]);
  });

  it('returns empty globalVariables when stored value is invalid', () => {
    settingsStore.general = JSON.stringify({
      ...DEFAULT_GENERAL_SETTINGS,
      globalVariables: 'not-an-array'
    });

    expect(getGeneralSettings().globalVariables).toEqual([]);
  });

  it('defaults followRedirects to true when unset', () => {
    expect(getGeneralSettings().followRedirects).toBe(true);
  });

  it('defaults scriptTimeoutMs to 5000 when unset', () => {
    expect(getGeneralSettings().scriptTimeoutMs).toBe(5000);
  });

  it('normalizes invalid scriptTimeoutMs to the default', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      scriptTimeoutMs: -100
    });

    expect(getGeneralSettings().scriptTimeoutMs).toBe(DEFAULT_GENERAL_SETTINGS.scriptTimeoutMs);
  });

  it('persists followRedirects false', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      followRedirects: false
    });

    expect(getGeneralSettings().followRedirects).toBe(false);
  });

  it('defaults warnWhenSwitchingThemes to true when unset', () => {
    expect(getGeneralSettings().warnWhenSwitchingThemes).toBe(true);
  });

  it('persists warnWhenSwitchingThemes false', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      warnWhenSwitchingThemes: false
    });

    expect(getGeneralSettings().warnWhenSwitchingThemes).toBe(false);
  });
});
