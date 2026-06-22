import { app, nativeTheme } from 'electron';
import type { IDatabase } from '#/main/db/IDatabase';
import { RoutingDatabase } from '#/main/db/RoutingDatabase';
import { rebuildAppMenu } from '#/main/appMenu';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import {
  deleteDatabaseConnection,
  getActiveDatabaseId,
  listDatabaseConnections,
  saveDatabaseConnection,
  setActiveDatabaseId
} from '#/main/settings/databaseSettings';
import {
  assignSlotForNewTeamHub,
  getSlotForConnection,
  removeSlotForConnection
} from '#/main/settings/databaseSlots';
import { deleteTeamHub, listTeamHubs, saveTeamHub } from '#/main/settings/teamHubSettings';
import { getAiSettings, setAiSettings } from '#/main/settings/aiSettings';
import { getGeneralSettings, setGeneralSettings } from '#/main/settings/generalSettings';
import {
  deleteRequestEditorTab,
  getRequestEditorTab,
  setRequestEditorTab
} from '#/main/settings/requestEditorSettings';
import { getAiChatSession, setAiChatSession } from '#/main/settings/aiChatSessionSettings';
import { getPanelLayout, setPanelLayout } from '#/main/settings/panelLayoutSettings';
import { getSidebarExpansion, setSidebarExpansion } from '#/main/settings/sidebarExpansionSettings';
import { checkForUpdates } from '#/main/settings/updateCheck';
import {
  getResolvedShortcuts,
  resetShortcuts,
  setShortcutOverrides,
  validateShortcuts
} from '#/main/settings/shortcutSettings';
import type { ThemeSource } from '#/shared/types';

const THEME_SETTING_KEY = 'theme';

/**
 * Validates and returns a theme source value.
 *
 * @param value - Raw stored theme value.
 * @returns A valid theme source, defaulting to system.
 */
function parseThemeSource(value: string | undefined): ThemeSource {
  if (value === 'light' || value === 'dark' || value === 'system' || value === 'high-contrast') {
    return value;
  }
  return 'system';
}

/**
 * Maps a persisted theme preference to Electron's nativeTheme.themeSource.
 *
 * High contrast is stored separately but applied as dark so native chrome and
 * prefers-color-scheme consumers stay on the dark palette.
 *
 * @param theme - Persisted theme preference.
 * @returns Value suitable for nativeTheme.themeSource.
 */
function resolveNativeThemeSource(theme: ThemeSource): 'light' | 'dark' | 'system' {
  return theme === 'high-contrast' ? 'dark' : theme;
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

  // Compares the running version against the latest GitHub release.
  handle('app:checkForUpdates', ipcArgSchemas.none, () => checkForUpdates());

  // Returns the persisted light/dark/system/high-contrast theme preference.
  handle('theme:get', ipcArgSchemas.none, async () =>
    parseThemeSource(await db.getSetting(THEME_SETTING_KEY))
  );

  // Persists and applies the light/dark/system/high-contrast theme preference.
  handle('theme:set', ipcArgSchemas.themeSet, async (_event, theme) => {
    nativeTheme.themeSource = resolveNativeThemeSource(theme);
    await db.setSetting(THEME_SETTING_KEY, theme);
  });

  // Returns general HTTP execution settings (timeout, size limit, SSL verify).
  handle('general:getSettings', ipcArgSchemas.none, () => getGeneralSettings());

  // Persists general HTTP execution settings.
  handle('general:setSettings', ipcArgSchemas.generalSettings, (_event, settings) => {
    setGeneralSettings(settings);
  });

  // Returns persisted AI provider API keys.
  handle('ai:getSettings', ipcArgSchemas.none, () => getAiSettings());

  // Persists AI provider API keys.
  handle('ai:setSettings', ipcArgSchemas.aiSettings, (_event, settings) => {
    setAiSettings(settings);
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

  // Lists configured team hubs.
  handle('teamHubs:list', ipcArgSchemas.none, () => listTeamHubs());

  // Creates or updates a team hub.
  handle('teamHubs:save', ipcArgSchemas.teamHub, async (_event, hub) => {
    const existingHubs = listTeamHubs();
    const trimmedId = hub.id.trim();
    const isNew = trimmedId.length === 0 || !existingHubs.some((item) => item.id === trimmedId);
    const hubs = saveTeamHub(hub);
    const saved =
      hubs.find((item) => item.id === trimmedId) ??
      (trimmedId.length === 0 ? hubs[hubs.length - 1] : undefined);

    if (saved && db instanceof RoutingDatabase) {
      if (isNew) {
        assignSlotForNewTeamHub(saved.id);
      }
      const slot = getSlotForConnection(saved.id);
      if (slot != null) {
        await db.mountTeamHub(saved, slot);
        await db.syncTeamHub(saved.id);
      }
    }

    return hubs;
  });

  // Re-reads collection data from a single provider (database or team hub).
  handle('providers:sync', ipcArgSchemas.providerSync, async (_event, connectionId) => {
    if (db instanceof RoutingDatabase) {
      await db.syncProvider(connectionId);
    }
  });

  // Deletes a team hub by id.
  handle('teamHubs:delete', ipcArgSchemas.connectionId, async (_event, id) => {
    if (db instanceof RoutingDatabase) {
      await db.removeTeamHub(id);
      removeSlotForConnection(id);
    }
    return deleteTeamHub(id);
  });

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

  // Returns persisted sidebar expansion for sections, collections, and folders.
  handle('sidebar:getExpansion', ipcArgSchemas.none, () => getSidebarExpansion());

  // Persists sidebar expansion for sections, collections, and folders.
  handle('sidebar:setExpansion', ipcArgSchemas.sidebarExpansionSet, (_event, state) => {
    setSidebarExpansion(state);
  });

  // Returns persisted sidebar and AI sidebar visibility preferences.
  handle('layout:getPanel', ipcArgSchemas.none, () => getPanelLayout());

  // Persists sidebar and AI sidebar visibility preferences.
  handle('layout:setPanel', ipcArgSchemas.panelLayoutSet, (_event, state) => {
    setPanelLayout(state);
  });

  // Returns persisted AI chat open tabs and active tab.
  handle('aiChat:getSession', ipcArgSchemas.none, () => getAiChatSession());

  // Persists AI chat open tabs and active tab.
  handle('aiChat:setSession', ipcArgSchemas.aiChatSessionSet, (_event, state) => {
    setAiChatSession(state);
  });

  // Returns resolved keyboard shortcut bindings.
  handle('shortcuts:get', ipcArgSchemas.none, () => getResolvedShortcuts());

  // Persists keyboard shortcut overrides and rebuilds the application menu.
  handle('shortcuts:set', ipcArgSchemas.shortcutOverridesSet, (_event, overrides) => {
    const validation = validateShortcuts(overrides);
    if (!validation.valid) {
      throw new Error('Invalid shortcut configuration.');
    }
    const bindings = setShortcutOverrides(overrides);
    rebuildAppMenu();
    return bindings;
  });

  // Clears keyboard shortcut overrides and rebuilds the application menu.
  handle('shortcuts:reset', ipcArgSchemas.none, () => {
    const bindings = resetShortcuts();
    rebuildAppMenu();
    return bindings;
  });
}
