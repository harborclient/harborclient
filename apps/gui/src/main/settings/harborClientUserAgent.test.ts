import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_GENERAL_SETTINGS } from '@harborclient/core/generalSettings';
import { LEGACY_STATIC_HARBOR_CLIENT_USER_AGENT } from '@harborclient/core/userAgent';
import type { LocalDatabase } from '#/main/storage/LocalDatabase';
import {
  clearLocalDatabaseForTesting,
  setLocalDatabaseForTesting
} from '#/main/storage/localDatabaseInstance';

vi.mock('electron', () => ({
  app: {
    getVersion: () => '2.6.0',
    getPath: vi.fn(() => '/tmp/harborclient-ua-test')
  },
  session: {
    defaultSession: {
      setSpellCheckerEnabled: vi.fn()
    }
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => false),
    encryptString: vi.fn((value: string) => Buffer.from(value, 'utf8')),
    decryptString: vi.fn((buffer: Buffer) => buffer.toString('utf8'))
  },
  BrowserWindow: class {},
  screen: { getAllDisplays: () => [] }
}));

import { getGeneralSettings } from './generalSettings';
import {
  buildHarborClientUserAgentFromProcess,
  ensureHarborClientUserAgentSettings,
  needsHarborClientUserAgentCapture
} from './harborClientUserAgent';

describe('needsHarborClientUserAgentCapture', () => {
  it('returns true when settings are missing, empty, or legacy', () => {
    expect(needsHarborClientUserAgentCapture(null)).toBe(true);
    expect(needsHarborClientUserAgentCapture({})).toBe(true);
    expect(needsHarborClientUserAgentCapture({ userAgent: '' })).toBe(true);
    expect(
      needsHarborClientUserAgentCapture({ userAgent: LEGACY_STATIC_HARBOR_CLIENT_USER_AGENT })
    ).toBe(true);
  });

  it('returns false when a custom User-Agent is already set', () => {
    expect(needsHarborClientUserAgentCapture({ userAgent: 'Custom/1.0' })).toBe(false);
    expect(
      needsHarborClientUserAgentCapture({
        userAgent: 'HarborClient/2.6.0 (X11; Linux x86_64) Electron/39.0.0 Chrome/140.0.0.0'
      })
    ).toBe(false);
  });
});

describe('ensureHarborClientUserAgentSettings', () => {
  let settingsStore: Record<string, string>;
  let database: LocalDatabase;

  beforeEach(() => {
    settingsStore = {};
    database = {
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

  it('captures a dynamic User-Agent on first run and adds it to customUserAgents', () => {
    ensureHarborClientUserAgentSettings(database);

    const settings = getGeneralSettings();
    const expected = buildHarborClientUserAgentFromProcess();
    expect(settings.userAgent).toBe(expected);
    expect(settings.customUserAgents).toContain(expected);
    expect(settings.customUserAgents.filter((entry) => entry === expected)).toHaveLength(1);
  });

  it('migrates the legacy static HarborClient User-Agent once', () => {
    settingsStore.general = JSON.stringify({
      ...DEFAULT_GENERAL_SETTINGS,
      userAgent: LEGACY_STATIC_HARBOR_CLIENT_USER_AGENT,
      customUserAgents: []
    });

    ensureHarborClientUserAgentSettings(database);

    const settings = getGeneralSettings();
    const expected = buildHarborClientUserAgentFromProcess();
    expect(settings.userAgent).toBe(expected);
    expect(settings.userAgent).not.toBe(LEGACY_STATIC_HARBOR_CLIENT_USER_AGENT);
    expect(settings.customUserAgents).toContain(expected);
  });

  it('leaves a custom non-Harbor User-Agent untouched', () => {
    settingsStore.general = JSON.stringify({
      ...DEFAULT_GENERAL_SETTINGS,
      userAgent: 'CustomClient/9.0',
      customUserAgents: ['CustomClient/9.0']
    });

    ensureHarborClientUserAgentSettings(database);

    const settings = getGeneralSettings();
    expect(settings.userAgent).toBe('CustomClient/9.0');
    expect(settings.customUserAgents).toEqual(['CustomClient/9.0']);
  });

  it('is idempotent and does not duplicate customs', () => {
    ensureHarborClientUserAgentSettings(database);
    const first = getGeneralSettings();
    ensureHarborClientUserAgentSettings(database);
    const second = getGeneralSettings();

    expect(second.userAgent).toBe(first.userAgent);
    expect(second.customUserAgents).toEqual(first.customUserAgents);
    expect(second.customUserAgents.filter((entry) => entry === first.userAgent)).toHaveLength(1);
  });
});
