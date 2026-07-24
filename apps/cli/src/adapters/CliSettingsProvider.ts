import {
  DEFAULT_GENERAL_SETTINGS,
  normalizeGeneralSettings
} from '@harborclient/core/generalSettings';
import type { SettingsProvider } from '@harborclient/core/interfaces';
import type { GeneralSettings } from '@harborclient/core/types';
import { parseJson } from '@harborclient/core/parseJson';
import type { LocalDatabase } from '@harborclient/storage-sqlite';

const STORE_KEY = 'general';

/**
 * SettingsProvider backed by the same local SQLite registry as the GUI,
 * with optional CLI flag overrides applied on read.
 */
export class CliSettingsProvider implements SettingsProvider {
  private readonly database: LocalDatabase;
  private readonly overrides: Partial<GeneralSettings>;

  /**
   * @param database - Initialized local registry database.
   * @param overrides - Flag-driven overrides (timeout, SSL, etc.).
   */
  constructor(database: LocalDatabase, overrides: Partial<GeneralSettings> = {}) {
    this.database = database;
    this.overrides = overrides;
  }

  /**
   * Returns general settings from the registry with CLI overrides applied.
   *
   * @returns Normalized general settings.
   */
  getGeneralSettings(): GeneralSettings {
    const stored = parseJson<Partial<GeneralSettings>>(
      this.database.getSetting(STORE_KEY),
      DEFAULT_GENERAL_SETTINGS
    );
    return normalizeGeneralSettings({ ...stored, ...this.overrides });
  }

  /**
   * Persists general settings to the registry (does not merge CLI overrides).
   *
   * @param settings - Settings to store.
   */
  setGeneralSettings(settings: GeneralSettings): void {
    const normalized = normalizeGeneralSettings(settings);
    this.database.setSetting(STORE_KEY, JSON.stringify(normalized));
  }
}

/**
 * In-memory settings provider used for ad-hoc requests without opening the GUI database.
 *
 * @param overrides - Partial settings from CLI flags.
 * @returns SettingsProvider with defaults + overrides.
 */
export function createEphemeralSettingsProvider(
  overrides: Partial<GeneralSettings> = {}
): SettingsProvider {
  let current = normalizeGeneralSettings({ ...DEFAULT_GENERAL_SETTINGS, ...overrides });
  return {
    getGeneralSettings: () => current,
    setGeneralSettings: (settings) => {
      current = normalizeGeneralSettings(settings);
    }
  };
}
