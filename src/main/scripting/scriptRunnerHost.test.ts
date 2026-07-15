import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocalDatabase } from '#/main/storage/LocalDatabase';
import {
  clearLocalDatabaseForTesting,
  setLocalDatabaseForTesting
} from '#/main/storage/localDatabaseInstance';
import { DEFAULT_GENERAL_SETTINGS, setGeneralSettings } from '#/main/settings/generalSettings';
import { resolveScriptTimeoutMs } from './scriptRunnerHost';

describe('resolveScriptTimeoutMs', () => {
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
    vi.restoreAllMocks();
  });

  it('returns the default script timeout when unset', () => {
    expect(resolveScriptTimeoutMs()).toBe(DEFAULT_GENERAL_SETTINGS.scriptTimeoutMs);
  });

  it('returns persisted scriptTimeoutMs', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      scriptTimeoutMs: 12000
    });

    expect(resolveScriptTimeoutMs()).toBe(12000);
  });

  it('returns 0 when script timeouts are disabled', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      scriptTimeoutMs: 0
    });

    expect(resolveScriptTimeoutMs()).toBe(0);
  });

  it('falls back to default for invalid stored values', () => {
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      scriptTimeoutMs: -1
    });

    expect(resolveScriptTimeoutMs()).toBe(DEFAULT_GENERAL_SETTINGS.scriptTimeoutMs);
  });
});
