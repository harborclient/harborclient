import type { GeneralSettings } from '../types/settings';

/**
 * Read/write access to persisted general settings used by the request engine.
 *
 * GUI and CLI each supply an adapter (SQLite / electron-store vs config file + flags).
 * Engine code must never reach into storage singletons directly.
 */
export interface SettingsProvider {
  /**
   * Returns the current general settings with defaults applied.
   */
  getGeneralSettings(): GeneralSettings;

  /**
   * Persists general settings.
   *
   * @param settings - Normalized settings to store.
   */
  setGeneralSettings(settings: GeneralSettings): void;
}
