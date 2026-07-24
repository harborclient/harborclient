import type { AuthConfig, OAuthFetchTokenResult } from '#/shared/auth';
import type { CollectionRunnerConfig } from '#/shared/collectionRunner';
import type { ShortcutBinding, ShortcutOverrides } from '#/shared/shortcuts';
import type {
  AiChatSessionState,
  AiSettings,
  EditorTab,
  GeneralSettings,
  PanelLayoutState,
  SidebarExpansionState
} from '#/shared/types/settings';

/**
 * IPC methods for settings.
 */
export interface ApiSettings {
  /**
   * Returns persisted general request settings.
   */
  getGeneralSettings: () => Promise<GeneralSettings>;
  /**
   * Persists general request settings.
   *
   * @param settings - General configuration to store.
   */
  setGeneralSettings: (settings: GeneralSettings) => Promise<void>;
  /**
   * Returns persisted AI provider API keys.
   */
  getAiSettings: () => Promise<AiSettings>;
  /**
   * Persists AI provider API keys.
   *
   * @param settings - AI configuration to store.
   */
  setAiSettings: (settings: AiSettings) => Promise<void>;
  /**
   * Returns the id of the active database connection.
   */
  getActiveStorageId: () => Promise<string>;
  /**
   * Sets the active database connection (applied on restart).
   *
   * @param id - Connection id to activate.
   */
  setActiveStorageId: (id: string) => Promise<void>;
  /**
   * Returns the persisted request editor tab for a storage key.
   *
   * @param key - Saved request id or `tab:${tabId}` for unsaved drafts.
   */
  getRequestEditorTab: (key: string) => Promise<EditorTab | null>;
  /**
   * Persists the request editor tab for a storage key.
   *
   * @param key - Saved request id or `tab:${tabId}` for unsaved drafts.
   * @param tab - Editor tab to remember.
   */
  setRequestEditorTab: (key: string, tab: EditorTab) => Promise<void>;
  /**
   * Removes persisted request editor tab state for a storage key.
   *
   * @param key - Saved request id string to clear.
   */
  deleteRequestEditorTab: (key: string) => Promise<void>;
  /**
   * Returns the persisted sidebar section for a page tab key.
   *
   * @param key - Page sidebar storage key such as `settings` or `plugins`.
   */
  getPageSidebarSection: (key: string) => Promise<string | null>;
  /**
   * Persists the sidebar section for a page tab key.
   *
   * @param key - Page sidebar storage key such as `settings` or `plugins`.
   * @param section - Section id to remember.
   */
  setPageSidebarSection: (key: string, section: string) => Promise<void>;
  /**
   * Returns persisted sidebar expansion for sections, collections, and folders.
   */
  getSidebarExpansion: () => Promise<SidebarExpansionState>;
  /**
   * Persists sidebar expansion for sections, collections, and folders.
   *
   * @param state - Expansion snapshot to store.
   */
  setSidebarExpansion: (state: SidebarExpansionState) => Promise<void>;
  /**
   * Returns persisted sidebar and AI sidebar visibility preferences.
   */
  getPanelLayout: () => Promise<PanelLayoutState>;
  /**
   * Persists sidebar and AI sidebar visibility preferences.
   *
   * @param state - Panel layout snapshot to store.
   */
  setPanelLayout: (state: PanelLayoutState) => Promise<void>;
  /**
   * Returns persisted AI chat open tabs and active tab.
   */
  getAiChatSession: () => Promise<AiChatSessionState>;
  /**
   * Persists AI chat open tabs and active tab.
   *
   * @param state - Chat session snapshot to store.
   */
  setAiChatSession: (state: AiChatSessionState) => Promise<void>;
  /**
   * Returns persisted open request tabs as a JSON payload.
   */
  getOpenTabsPayload: () => Promise<string | null>;
  /**
   * Persists open request tabs as a JSON payload.
   *
   * @param payload - Serialized open-tabs JSON from the renderer.
   */
  setOpenTabsPayload: (payload: string) => Promise<void>;
  /**
   * Returns persisted collection runner configuration.
   */
  getCollectionRunnerConfig: () => Promise<CollectionRunnerConfig>;
  /**
   * Persists collection runner configuration.
   *
   * @param config - Runner settings snapshot to store.
   */
  setCollectionRunnerConfig: (config: CollectionRunnerConfig) => Promise<void>;
  /**
   * Returns resolved keyboard shortcut bindings with user overrides applied.
   */
  getShortcuts: () => Promise<ShortcutBinding[]>;
  /**
   * Persists keyboard shortcut overrides and rebuilds the application menu.
   *
   * @param overrides - Shortcut overrides keyed by shortcut id.
   */
  setShortcuts: (overrides: ShortcutOverrides) => Promise<ShortcutBinding[]>;
  /**
   * Clears keyboard shortcut overrides and restores default bindings.
   */
  resetShortcuts: () => Promise<ShortcutBinding[]>;
  /**
   * Fetches or returns a cached OAuth 2.0 access token using Client Credentials.
   *
   * @param cacheKey - Stable cache key; empty string skips persistence.
   * @param config - Resolved OAuth 2.0 configuration.
   * @param force - When true, bypass cache and fetch a fresh token.
   */
  oauthFetchToken: (
    cacheKey: string,
    config: AuthConfig['oauth2'],
    force: boolean
  ) => Promise<OAuthFetchTokenResult>;
  /**
   * Clears a cached OAuth 2.0 access token for the given cache key.
   *
   * @param cacheKey - Stable cache key such as request:1 or collection:2.
   */
  oauthClearToken: (cacheKey: string) => Promise<void>;
  /**
   * Returns persisted autocomplete values for a category.
   *
   * @param category - Autocomplete pool id (e.g. `header.key`, `url`).
   */
  getAutocompleteValues: (category: string) => Promise<string[]>;
  /**
   * Persists a new autocomplete value for a category.
   *
   * @param category - Autocomplete pool id.
   * @param value - User-committed value to remember.
   */
  addAutocompleteValue: (category: string, value: string) => Promise<void>;
}
