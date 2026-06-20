import { app, nativeTheme } from 'electron';
import type { IDatabase } from '#/main/db/IDatabase';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import {
  deleteDatabaseConnection,
  getActiveDatabaseId,
  listDatabaseConnections,
  saveDatabaseConnection,
  setActiveDatabaseId
} from '#/main/settings/databaseSettings';
import { getGeneralSettings, setGeneralSettings } from '#/main/settings/generalSettings';
import {
  deleteRequestEditorTab,
  getRequestEditorTab,
  setRequestEditorTab
} from '#/main/settings/requestEditorSettings';
import type { ThemeSource } from '#/shared/types';

const THEME_SETTING_KEY = 'theme';

/**
 * Validates and returns a theme source value.
 *
 * @param value - Raw stored theme value.
 * @returns A valid theme source, defaulting to system.
 */
function parseThemeSource(value: string | undefined): ThemeSource {
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }
  return 'system';
}

/**
 * Registers IPC handlers for app metadata, theme, general settings, database
 * connections, and request editor tab persistence.
 *
 * @param db - Database instance used for theme setting storage.
 */
export function registerSettingsHandlers(db: IDatabase): void {
  // Returns the application semver from package metadata.
  handle('app:getVersion', ipcArgSchemas.none, () => app.getVersion());

  // Returns the persisted light/dark/system theme preference.
  handle('theme:get', ipcArgSchemas.none, async () =>
    parseThemeSource(await db.getSetting(THEME_SETTING_KEY))
  );

  // Persists and applies the light/dark/system theme preference.
  handle('theme:set', ipcArgSchemas.themeSet, async (_event, theme) => {
    nativeTheme.themeSource = theme;
    await db.setSetting(THEME_SETTING_KEY, theme);
  });

  // Returns general HTTP execution settings (timeout, size limit, SSL verify).
  handle('general:getSettings', ipcArgSchemas.none, () => getGeneralSettings());

  // Persists general HTTP execution settings.
  handle('general:setSettings', ipcArgSchemas.generalSettings, (_event, settings) => {
    setGeneralSettings(settings);
  });

  // Lists configured database connections.
  handle('databaseConnections:list', ipcArgSchemas.none, () => listDatabaseConnections());

  // Creates or updates a database connection.
  handle('databaseConnections:save', ipcArgSchemas.databaseConnection, (_event, conn) =>
    saveDatabaseConnection(conn)
  );

  // Deletes a database connection by id.
  handle('databaseConnections:delete', ipcArgSchemas.connectionId, (_event, id) =>
    deleteDatabaseConnection(id)
  );

  // Returns the id of the active database connection.
  handle('database:getActiveId', ipcArgSchemas.none, () => getActiveDatabaseId());

  // Sets the active database connection (applied on restart).
  handle('database:setActiveId', ipcArgSchemas.connectionId, (_event, id) => {
    setActiveDatabaseId(id);
  });

  // Returns the persisted request editor tab for a storage key.
  handle('requestEditor:getTab', ipcArgSchemas.storageKey, (_event, key) =>
    getRequestEditorTab(key)
  );

  // Persists the active request editor tab for a storage key.
  handle('requestEditor:setTab', ipcArgSchemas.setEditorTab, (_event, key, tab) => {
    setRequestEditorTab(key, tab);
  });

  // Clears the persisted request editor tab for a storage key.
  handle('requestEditor:deleteTab', ipcArgSchemas.storageKey, (_event, key) => {
    deleteRequestEditorTab(key);
  });
}
