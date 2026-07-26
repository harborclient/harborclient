import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_GENERAL_SETTINGS } from '@harborclient/core/generalSettings';
import {
  DEFAULT_USER_AGENT,
  LEGACY_STATIC_HARBOR_CLIENT_USER_AGENT
} from '@harborclient/core/userAgent';
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
  resolveHarborClientUserAgentSettings
} from './harborClientUserAgent';

describe('resolveHarborClientUserAgentSettings', () => {
  const current = 'HarborClient/2.7.0 (X11; Linux x86_64) Electron/42.6.1 Chrome/148.0.7778.280';
  const stale = 'HarborClient/2.6.0 (X11; Linux x86_64) Electron/39.0.0 Chrome/140.0.0.0';

  it('captures a dynamic User-Agent when settings are missing or empty', () => {
    expect(resolveHarborClientUserAgentSettings(null, current)?.userAgent).toBe(current);
    expect(resolveHarborClientUserAgentSettings({}, current)?.userAgent).toBe(current);
    expect(resolveHarborClientUserAgentSettings({ userAgent: '' }, current)?.userAgent).toBe(
      current
    );
  });

  it('migrates the legacy static and default HarborClient User-Agents', () => {
    expect(
      resolveHarborClientUserAgentSettings(
        { userAgent: LEGACY_STATIC_HARBOR_CLIENT_USER_AGENT },
        current
      )?.userAgent
    ).toBe(current);
    expect(
      resolveHarborClientUserAgentSettings({ userAgent: DEFAULT_USER_AGENT }, current)?.userAgent
    ).toBe(current);
  });

  it('refreshes a stale generated User-Agent on version upgrade', () => {
    const next = resolveHarborClientUserAgentSettings(
      {
        userAgent: stale,
        customUserAgents: [stale, 'Custom/1.0']
      },
      current
    );
    expect(next).toEqual(
      expect.objectContaining({
        userAgent: current,
        customUserAgents: [current, 'Custom/1.0']
      })
    );
  });

  it('leaves a custom non-Harbor User-Agent untouched while syncing presets', () => {
    const next = resolveHarborClientUserAgentSettings(
      {
        userAgent: 'CustomClient/9.0',
        customUserAgents: ['CustomClient/9.0', stale]
      },
      current
    );
    expect(next).toEqual(
      expect.objectContaining({
        userAgent: 'CustomClient/9.0',
        customUserAgents: ['CustomClient/9.0', current]
      })
    );
  });

  it('returns null when the global default and presets are already current', () => {
    expect(
      resolveHarborClientUserAgentSettings(
        {
          userAgent: current,
          customUserAgents: [current, 'Custom/1.0']
        },
        current
      )
    ).toBeNull();
  });

  it('returns null for a custom default whose presets are already current', () => {
    expect(
      resolveHarborClientUserAgentSettings(
        {
          userAgent: 'CustomClient/9.0',
          customUserAgents: ['CustomClient/9.0', current]
        },
        current
      )
    ).toBeNull();
  });

  it('does not overwrite a hand-written HarborClient string', () => {
    const handwritten = 'HarborClient/2.6.0 (custom)';
    const next = resolveHarborClientUserAgentSettings(
      {
        userAgent: handwritten,
        customUserAgents: [handwritten]
      },
      current
    );
    expect(next).toEqual(
      expect.objectContaining({
        userAgent: handwritten,
        customUserAgents: [handwritten, current]
      })
    );
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

  it('migrates the legacy static HarborClient User-Agent', () => {
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

  it('refreshes a stale generated User-Agent without duplicating presets', () => {
    const stale = 'HarborClient/1.0.0 (X11; Linux x86_64) Electron/30.0.0 Chrome/120.0.0.0';
    settingsStore.general = JSON.stringify({
      ...DEFAULT_GENERAL_SETTINGS,
      userAgent: stale,
      customUserAgents: [stale, 'Custom/1.0']
    });

    ensureHarborClientUserAgentSettings(database);

    const settings = getGeneralSettings();
    const expected = buildHarborClientUserAgentFromProcess();
    expect(settings.userAgent).toBe(expected);
    expect(settings.customUserAgents).toEqual([expected, 'Custom/1.0']);
  });

  it('leaves a custom non-Harbor User-Agent untouched', () => {
    const current = buildHarborClientUserAgentFromProcess();
    settingsStore.general = JSON.stringify({
      ...DEFAULT_GENERAL_SETTINGS,
      userAgent: 'CustomClient/9.0',
      customUserAgents: ['CustomClient/9.0', current]
    });

    ensureHarborClientUserAgentSettings(database);

    const settings = getGeneralSettings();
    expect(settings.userAgent).toBe('CustomClient/9.0');
    expect(settings.customUserAgents).toEqual(['CustomClient/9.0', current]);
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
