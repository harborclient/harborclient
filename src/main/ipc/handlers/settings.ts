import { app, nativeTheme } from 'electron';
import { isPickThemeFlagEnabled } from '#/main/pickTheme';
import { getStartupThemeOverride } from '#/main/startupTheme';
import type { IStorage } from '#/main/storage/IStorage';
import { RoutingStorage } from '#/main/storage/RoutingStorage';
import { rebuildAppMenu, setMenuActiveTheme } from '#/main/appMenu';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import {
  deleteStorageConnection,
  getActiveStorageId,
  isStorageConnectionConfigured,
  listStorageConnections,
  saveStorageConnection,
  setActiveStorageId
} from '#/main/settings/storageSettings';
import {
  assignSlotForNewTeamHub,
  getSlotForConnection,
  removeSlotForConnection
} from '#/main/settings/storageSlots';
import { deleteTeamHub, listTeamHubs, saveTeamHub } from '#/main/settings/teamHubSettings';
import { refreshTeamHubPluginSources } from '#/main/settings/teamHubPluginSources';
import { clearTrustedKeysCache } from '#/main/plugins/pluginSignature';
import { resyncUserTeamHubsSharingServer } from '#/main/settings/teamHubCollectionResync';
import { scanTeamHubSessions } from '#/main/settings/teamHubSessionScan';
import {
  TeamHubClient,
  type FolderRecord,
  type SavedRequestRecord
} from '@harborclient/team-hub-api';
import type { TeamHubAdminCollectionContents } from '#/shared/types';
import { getAiSettings, setAiSettings } from '#/main/settings/aiSettings';
import { getGeneralSettings, setGeneralSettings } from '#/main/settings/generalSettings';
import {
  deleteRequestEditorTab,
  getRequestEditorTab,
  setRequestEditorTab
} from '#/main/settings/requestEditorSettings';
import { getPageSidebarSection, setPageSidebarSection } from '#/main/settings/pageSidebarSettings';
import {
  getCollectionRunnerConfig,
  setCollectionRunnerConfig
} from '#/main/settings/collectionRunnerSettings';
import { addAutocompleteValue, getAutocompleteValues } from '#/main/settings/autocompleteSettings';
import { getAiChatSession, setAiChatSession } from '#/main/settings/aiChatSessionSettings';
import { getOpenTabsPayload, setOpenTabsPayload } from '#/main/settings/openTabsSettings';
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

/**
 * Maps server folder and request records to renderer-facing admin summaries.
 *
 * @param folders - Folder records from the admin collection inspection API.
 * @param requests - Saved request records from the admin collection inspection API.
 * @returns Summaries suitable for the Manage collections request list UI.
 */
function mapTeamHubAdminCollectionContents(
  folders: FolderRecord[],
  requests: SavedRequestRecord[]
): TeamHubAdminCollectionContents {
  return {
    folders: folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      sortOrder: folder.sortOrder
    })),
    requests: requests.map((request) => ({
      id: request.id,
      name: request.name,
      method: request.method,
      url: request.url,
      folderId: request.folderId,
      sortOrder: request.sortOrder
    }))
  };
}

const THEME_SETTING_KEY = 'theme';
const THEME_PICKER_SEEN_KEY = 'themePickerSeen';

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
  if (value?.startsWith('plugin:')) {
    return value as ThemeSource;
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
  if (theme === 'light' || theme === 'dark' || theme === 'system') {
    return theme;
  }
  return 'dark';
}

/**
 * Registers IPC handlers for app metadata, theme, general settings, database
 * connections, and request editor tab persistence.
 *
 * @param db - Database instance used for theme setting storage.
 */
export function registerSettingsHandlers(db: IStorage): void {
  // Returns the application semver from package metadata.
  handle('app:getVersion', ipcArgSchemas.none, () => app.getVersion());

  // Compares the running version against the latest GitHub release.
  handle('app:checkForUpdates', ipcArgSchemas.none, () => checkForUpdates());

  // Returns the persisted light/dark/system/high-contrast theme preference.
  handle('theme:get', ipcArgSchemas.none, async () => {
    const override = getStartupThemeOverride();
    if (override != null) {
      return override;
    }
    return parseThemeSource(await db.getSetting(THEME_SETTING_KEY));
  });

  // Persists and applies the light/dark/system/high-contrast theme preference.
  handle('theme:set', ipcArgSchemas.themeSet, async (event, theme) => {
    nativeTheme.themeSource = resolveNativeThemeSource(theme as ThemeSource);
    await db.setSetting(THEME_SETTING_KEY, theme);
    setMenuActiveTheme(theme as ThemeSource);
    event.sender.send('theme:changed', theme);
  });

  // Applies a theme preference without persisting it (used by the theme picker preview).
  handle('theme:preview', ipcArgSchemas.themeSet, async (_event, theme) => {
    nativeTheme.themeSource = resolveNativeThemeSource(theme as ThemeSource);
  });

  // Returns whether the first-run theme picker modal should open.
  handle('theme:shouldPrompt', ipcArgSchemas.none, async () => {
    if (isPickThemeFlagEnabled()) {
      return true;
    }
    if (getStartupThemeOverride() != null) {
      return false;
    }
    return (await db.getSetting(THEME_PICKER_SEEN_KEY)) !== '1';
  });

  // Marks the first-run theme picker as seen so it is not shown again.
  handle('theme:markPickerSeen', ipcArgSchemas.none, async () => {
    await db.setSetting(THEME_PICKER_SEEN_KEY, '1');
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
  handle('storageConnections:list', ipcArgSchemas.none, () => listStorageConnections());

  // Creates or updates a database connection.
  handle('storageConnections:save', ipcArgSchemas.storageConnection, async (_event, conn) => {
    const isNew = !listStorageConnections().some((item) => item.id === conn.id);
    const connections = saveStorageConnection(conn);
    const saved = connections.find((item) => item.id === conn.id);

    if (saved && db instanceof RoutingStorage && isStorageConnectionConfigured(saved)) {
      const slot = getSlotForConnection(saved.id);
      if (slot != null) {
        await db.mountStorageConnection(saved, { reconcileGit: !isNew });
      }
    }

    return connections;
  });

  // Deletes a database connection by id.
  handle('storageConnections:delete', ipcArgSchemas.connectionId, (_event, id) =>
    deleteStorageConnection(id)
  );

  // Lists configured team hubs.
  handle('teamHubs:list', ipcArgSchemas.none, () => listTeamHubs());

  // Probes configured team hubs for session capabilities.
  handle('teamHubs:scanSessions', ipcArgSchemas.none, () => scanTeamHubSessions(listTeamHubs()));

  // Lists Team Hub user accounts using an admin token on the given hub connection.
  handle('teamHubs:listUsers', ipcArgSchemas.connectionId, async (_event, hubId) => {
    const hub = listTeamHubs().find((entry) => entry.id === hubId);
    if (!hub) {
      throw new Error(`Unknown team hub: ${hubId}`);
    }

    const client = new TeamHubClient({ baseUrl: hub.baseUrl, token: hub.token });
    return client.listAdminUsers();
  });

  // Updates a Team Hub user account using an admin token on the given hub connection.
  handle(
    'teamHubs:updateUser',
    ipcArgSchemas.teamHubUserUpdate,
    async (_event, hubId, userId, input) => {
      const hub = listTeamHubs().find((entry) => entry.id === hubId);
      if (!hub) {
        throw new Error(`Unknown team hub: ${hubId}`);
      }

      const client = new TeamHubClient({ baseUrl: hub.baseUrl, token: hub.token });
      const updated = await client.updateAdminUser(userId, input);

      if (db instanceof RoutingStorage) {
        await resyncUserTeamHubsSharingServer(db, hubId, listTeamHubs());
      }

      return updated;
    }
  );

  // Deletes a Team Hub user account using an admin token on the given hub connection.
  handle('teamHubs:deleteUser', ipcArgSchemas.teamHubUserDelete, async (_event, hubId, userId) => {
    const hub = listTeamHubs().find((entry) => entry.id === hubId);
    if (!hub) {
      throw new Error(`Unknown team hub: ${hubId}`);
    }

    const client = new TeamHubClient({ baseUrl: hub.baseUrl, token: hub.token });
    await client.deleteAdminUser(userId);
  });

  // Creates a Team Hub user account and initial token using an admin token.
  handle('teamHubs:createUser', ipcArgSchemas.teamHubUserCreate, async (_event, hubId, input) => {
    const hub = listTeamHubs().find((entry) => entry.id === hubId);
    if (!hub) {
      throw new Error(`Unknown team hub: ${hubId}`);
    }

    const client = new TeamHubClient({ baseUrl: hub.baseUrl, token: hub.token });
    const created = await client.createAdminUser(input);

    if (db instanceof RoutingStorage) {
      await resyncUserTeamHubsSharingServer(db, hubId, listTeamHubs());
    }

    return created;
  });

  // Lists Team Hub API tokens using an admin token on the given hub connection.
  handle('teamHubs:listTokens', ipcArgSchemas.teamHubTokenList, async (_event, hubId) => {
    const hub = listTeamHubs().find((entry) => entry.id === hubId);
    if (!hub) {
      throw new Error(`Unknown team hub: ${hubId}`);
    }

    const client = new TeamHubClient({ baseUrl: hub.baseUrl, token: hub.token });
    return client.listAdminTokens();
  });

  // Creates a Team Hub API token for a user using an admin token.
  handle(
    'teamHubs:createToken',
    ipcArgSchemas.teamHubTokenCreate,
    async (_event, hubId, userId, input) => {
      const hub = listTeamHubs().find((entry) => entry.id === hubId);
      if (!hub) {
        throw new Error(`Unknown team hub: ${hubId}`);
      }

      const client = new TeamHubClient({ baseUrl: hub.baseUrl, token: hub.token });
      return client.createAdminUserToken(userId, input);
    }
  );

  // Deletes a Team Hub API token using an admin token on the given hub connection.
  handle(
    'teamHubs:deleteToken',
    ipcArgSchemas.teamHubTokenDelete,
    async (_event, hubId, tokenId) => {
      const hub = listTeamHubs().find((entry) => entry.id === hubId);
      if (!hub) {
        throw new Error(`Unknown team hub: ${hubId}`);
      }

      const client = new TeamHubClient({ baseUrl: hub.baseUrl, token: hub.token });
      await client.deleteAdminToken(tokenId);
    }
  );

  // Loads admin resource options for user management forms on the given hub connection.
  handle('teamHubs:listAdminResourceOptions', ipcArgSchemas.connectionId, async (_event, hubId) => {
    const hub = listTeamHubs().find((entry) => entry.id === hubId);
    if (!hub) {
      throw new Error(`Unknown team hub: ${hubId}`);
    }

    const client = new TeamHubClient({ baseUrl: hub.baseUrl, token: hub.token });
    return client.listAdminResourceOptions();
  });

  // Loads folders and saved requests for admin collection inspection.
  handle(
    'teamHubs:listAdminCollectionContents',
    ipcArgSchemas.teamHubCollectionContents,
    async (_event, hubId, collectionId) => {
      const hub = listTeamHubs().find((entry) => entry.id === hubId);
      if (!hub) {
        throw new Error(`Unknown team hub: ${hubId}`);
      }

      const client = new TeamHubClient({ baseUrl: hub.baseUrl, token: hub.token });
      const [folders, requests] = await Promise.all([
        client.listAdminCollectionFolders(collectionId),
        client.listAdminCollectionRequests(collectionId)
      ]);
      return mapTeamHubAdminCollectionContents(folders, requests);
    }
  );

  // Deletes a hub collection using an admin token.
  handle(
    'teamHubs:deleteCollection',
    ipcArgSchemas.teamHubCollectionDelete,
    async (_event, hubId, collectionId) => {
      const hub = listTeamHubs().find((entry) => entry.id === hubId);
      if (!hub) {
        throw new Error(`Unknown team hub: ${hubId}`);
      }

      const client = new TeamHubClient({ baseUrl: hub.baseUrl, token: hub.token });
      await client.deleteAdminCollection(collectionId);
    }
  );

  // Deletes a saved request on a hub collection using an admin token.
  handle(
    'teamHubs:deleteRequest',
    ipcArgSchemas.teamHubRequestDelete,
    async (_event, hubId, requestId) => {
      const hub = listTeamHubs().find((entry) => entry.id === hubId);
      if (!hub) {
        throw new Error(`Unknown team hub: ${hubId}`);
      }

      const client = new TeamHubClient({ baseUrl: hub.baseUrl, token: hub.token });
      await client.deleteAdminRequest(requestId);
    }
  );

  // Deletes a hub environment using an admin token.
  handle(
    'teamHubs:deleteEnvironment',
    ipcArgSchemas.teamHubEnvironmentDelete,
    async (_event, hubId, environmentId) => {
      const hub = listTeamHubs().find((entry) => entry.id === hubId);
      if (!hub) {
        throw new Error(`Unknown team hub: ${hubId}`);
      }

      const client = new TeamHubClient({ baseUrl: hub.baseUrl, token: hub.token });
      await client.deleteAdminEnvironment(environmentId);
    }
  );

  // Updates whether non-admin users may delete a hub collection.
  handle(
    'teamHubs:updateCollectionDeletionLocked',
    ipcArgSchemas.teamHubCollectionDeletionLocked,
    async (_event, hubId, collectionId, deletionLocked) => {
      const hub = listTeamHubs().find((entry) => entry.id === hubId);
      if (!hub) {
        throw new Error(`Unknown team hub: ${hubId}`);
      }

      const client = new TeamHubClient({ baseUrl: hub.baseUrl, token: hub.token });
      return client.updateAdminCollectionDeletionLocked(collectionId, deletionLocked);
    }
  );

  // Updates whether non-admin users may delete a hub environment.
  handle(
    'teamHubs:updateEnvironmentDeletionLocked',
    ipcArgSchemas.teamHubEnvironmentDeletionLocked,
    async (_event, hubId, environmentId, deletionLocked) => {
      const hub = listTeamHubs().find((entry) => entry.id === hubId);
      if (!hub) {
        throw new Error(`Unknown team hub: ${hubId}`);
      }

      const client = new TeamHubClient({ baseUrl: hub.baseUrl, token: hub.token });
      return client.updateAdminEnvironmentDeletionLocked(environmentId, deletionLocked);
    }
  );

  // Re-reads reloadable Team Hub config sections using an admin token.
  handle('teamHubs:reloadConfig', ipcArgSchemas.connectionId, async (_event, hubId) => {
    const hub = listTeamHubs().find((entry) => entry.id === hubId);
    if (!hub) {
      throw new Error(`Unknown team hub: ${hubId}`);
    }

    const client = new TeamHubClient({ baseUrl: hub.baseUrl, token: hub.token });
    const result = await client.reloadConfig();

    await refreshTeamHubPluginSources().catch((err) => {
      console.warn('Failed to refresh Team Hub plugin sources:', err);
    });
    clearTrustedKeysCache();

    return result;
  });

  // Creates or updates a team hub.
  handle('teamHubs:save', ipcArgSchemas.teamHub, async (_event, hub) => {
    const existingHubs = listTeamHubs();
    const trimmedId = hub.id.trim();
    const isNew = trimmedId.length === 0 || !existingHubs.some((item) => item.id === trimmedId);
    const hubs = saveTeamHub(hub);
    const saved =
      hubs.find((item) => item.id === trimmedId) ??
      (trimmedId.length === 0 ? hubs[hubs.length - 1] : undefined);

    if (saved && db instanceof RoutingStorage) {
      if (isNew) {
        assignSlotForNewTeamHub(saved.id);
      }
      const slot = getSlotForConnection(saved.id);
      if (slot != null) {
        await db.mountTeamHub(saved, slot);
        await db.syncTeamHub(saved.id);
      }
    }

    await refreshTeamHubPluginSources().catch((err) => {
      console.warn('Failed to refresh Team Hub plugin sources:', err);
    });
    clearTrustedKeysCache();

    return hubs;
  });

  // Re-reads collection data from a single provider (database or team hub).
  handle('providers:sync', ipcArgSchemas.providerSync, async (_event, connectionId) => {
    if (db instanceof RoutingStorage) {
      await db.syncProvider(connectionId);
    }
  });

  // Lists collections on a mounted provider that are not yet in the sidebar registry.
  handle(
    'providers:listUnregisteredCollections',
    ipcArgSchemas.providerListUnregisteredCollections,
    async (_event, connectionId) => {
      if (!(db instanceof RoutingStorage)) {
        return [];
      }
      return db.listUnregisteredCollections(connectionId);
    }
  );

  // Registers selected provider collections in the sidebar registry.
  handle(
    'providers:registerDiscoveredCollections',
    ipcArgSchemas.providerRegisterDiscoveredCollections,
    async (_event, connectionId, providerCollectionIds) => {
      if (!(db instanceof RoutingStorage)) {
        return { added: 0 };
      }
      const added = await db.registerDiscoveredCollections(connectionId, providerCollectionIds);
      return { added };
    }
  );

  // Records that the user skipped collection discovery for a storage connection.
  handle(
    'providers:markCollectionDiscoverySkipped',
    ipcArgSchemas.providerMarkCollectionDiscoverySkipped,
    (_event, connectionId) => {
      const connections = listStorageConnections();
      const connection = connections.find((item) => item.id === connectionId);
      if (!connection) {
        throw new Error(`Unknown database connection: ${connectionId}`);
      }
      return saveStorageConnection({ ...connection, collectionDiscoverySkipped: true });
    }
  );

  // Deletes a team hub by id.
  handle('teamHubs:delete', ipcArgSchemas.connectionId, async (_event, id) => {
    if (db instanceof RoutingStorage) {
      await db.removeTeamHub(id);
      removeSlotForConnection(id);
    }
    const hubs = deleteTeamHub(id);
    await refreshTeamHubPluginSources().catch((err) => {
      console.warn('Failed to refresh Team Hub plugin sources:', err);
    });
    clearTrustedKeysCache();
    return hubs;
  });

  // Returns the id of the active database connection.
  handle('storage:getActiveId', ipcArgSchemas.none, () => getActiveStorageId());

  // Sets the active database connection (applied on restart).
  handle('storage:setActiveId', ipcArgSchemas.connectionId, (_event, id) => {
    setActiveStorageId(id);
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

  // Returns the persisted sidebar section for a page tab key.
  handle('pageSidebar:getSection', ipcArgSchemas.storageKey, (_event, key) =>
    getPageSidebarSection(key)
  );

  // Persists the sidebar section for a page tab key.
  handle('pageSidebar:setSection', ipcArgSchemas.setPageSidebarSection, (_event, key, section) => {
    setPageSidebarSection(key, section);
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

  // Returns persisted open request tabs as a JSON payload.
  handle('openTabs:getPayload', ipcArgSchemas.none, () => getOpenTabsPayload());

  // Persists open request tabs as a JSON payload.
  handle('openTabs:setPayload', ipcArgSchemas.openTabsPayloadSet, (_event, payload) => {
    setOpenTabsPayload(payload);
  });

  // Returns persisted autocomplete values for a category.
  handle('autocomplete:list', ipcArgSchemas.autocompleteList, (_event, category) =>
    getAutocompleteValues(category)
  );

  // Persists a new autocomplete value for a category.
  handle('autocomplete:add', ipcArgSchemas.autocompleteAdd, (_event, category, value) => {
    addAutocompleteValue(category, value);
  });

  // Returns persisted collection runner configuration.
  handle('collectionRunner:getConfig', ipcArgSchemas.none, () => getCollectionRunnerConfig());

  // Persists collection runner configuration.
  handle(
    'collectionRunner:setConfig',
    ipcArgSchemas.collectionRunnerConfigSet,
    (_event, config) => {
      setCollectionRunnerConfig(config);
    }
  );

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
