import {
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_PROXY_SETTINGS,
  HARD_MAX_RESPONSE_SIZE_MB,
  normalizeGeneralSettings
} from '@harborclient/core/generalSettings';
import type { SettingsProvider } from '@harborclient/core/interfaces';
import { configureFileLogger } from '#/main/fileLogger';
import { syncTrayFromSettings } from '#/main/tray/trayHost';
import { applySpellCheckEnabled } from '#/main/window/spellCheck';
import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { parseJson } from '@harborclient/core/parseJson';
import type { GeneralSettings } from '@harborclient/core/types';

export {
  HARD_MAX_RESPONSE_SIZE_MB,
  DEFAULT_PROXY_SETTINGS,
  DEFAULT_GENERAL_SETTINGS,
  normalizeGeneralSettings
};

const STORE_KEY = 'general';

/**
 * Reads persisted general request settings.
 *
 * @returns Current general settings with defaults applied.
 */
export function getGeneralSettings(): GeneralSettings {
  const stored = parseJson<Partial<GeneralSettings>>(
    getLocalDatabase().getSetting(STORE_KEY),
    DEFAULT_GENERAL_SETTINGS
  );
  return normalizeGeneralSettings(stored);
}

/**
 * Persists general request settings.
 *
 * @param input - Settings to store.
 */
export function setGeneralSettings(input: GeneralSettings): void {
  const normalized = normalizeGeneralSettings(input);
  getLocalDatabase().setSetting(STORE_KEY, JSON.stringify(normalized));
  configureFileLogger(normalized);
  applySpellCheckEnabled(normalized.spellCheckEnabled);
  syncTrayFromSettings(normalized.closeToTray);
}

/**
 * GUI {@link SettingsProvider} backed by the local SQLite settings registry.
 */
export const guiSettingsProvider: SettingsProvider = {
  getGeneralSettings,
  setGeneralSettings
};

/**
 * Returns whether a plugin may perform outbound HTTP through hc.host.sendHttpRequest.
 *
 * @param pluginId - Plugin manifest id.
 * @returns True when global script network access is enabled or the plugin is allowlisted.
 */
export function isPluginNetworkAllowed(pluginId: string): boolean {
  const settings = getGeneralSettings();
  if (settings.allowScriptNetworkRequests) {
    return true;
  }
  return settings.allowedNetworkPlugins.includes(pluginId);
}

/**
 * Returns whether script-initiated file reads (and exists/stat) are allowed.
 *
 * @returns True when hc.fs read APIs may access the filesystem from scripts.
 */
export function isScriptFileReadAllowed(): boolean {
  return getGeneralSettings().allowScriptFileRead === true;
}

/**
 * Returns whether script-initiated file writes (and append) are allowed.
 *
 * @returns True when hc.fs write APIs may modify the filesystem from scripts.
 */
export function isScriptFileWriteAllowed(): boolean {
  return getGeneralSettings().allowScriptFileWrite === true;
}
