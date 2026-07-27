import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '#/renderer/src/store/redux';

/**
 * Parsed Team Hub join payload queued from invite links and deep links.
 */
export interface TeamHubJoinPayload {
  /**
   * Team Hub server base URL used for redemption.
   */
  baseUrl: string;

  /**
   * One-time invitation secret prefixed with `hbi_`.
   */
  code: string;

  /**
   * Invited user display name from the invite link, when present.
   */
  name?: string;

  /**
   * Invited user role from the invite link, when present.
   */
  role?: 'admin' | 'user';

  /**
   * ISO-8601 invitation expiry from the invite link, when present.
   */
  expiresAt?: string;

  /**
   * Friendly hub label from the invite link, when present.
   */
  hubName?: string;

  /**
   * Human-readable access summary from the invite link, when present.
   */
  accessSummary?: string;
}

/**
 * Session-only recording of sidebar and footer panel visibility for Hide/Show sidebars.
 */
export interface SidebarFooterLayoutSnapshot {
  /**
   * Whether the collections sidebar was open when recorded.
   */
  showSidebar: boolean;

  /**
   * Whether the AI sidebar was open when recorded.
   */
  showAiSidebar: boolean;

  /**
   * Whether the Git sidebar was open when recorded.
   */
  showGitSidebar: boolean;

  /**
   * Whether the Shortcuts sidebar was open when recorded.
   */
  showShortcutsSidebar: boolean;

  /**
   * Active plugin sidebar panel id within the Collections sidebar when recorded,
   * or null for the primary collections surface (replacement panel or built-in).
   */
  activeSidebarPanelId: string | null;

  /**
   * Whether the footer console panel was open when recorded.
   */
  showConsole: boolean;

  /**
   * Whether the footer variables panel was open when recorded.
   */
  showVariables: boolean;

  /**
   * Whether the footer MCP panel was open when recorded.
   */
  showMcp: boolean;

  /**
   * Whether the footer terminal panel was open when recorded.
   */
  showTerminal: boolean;

  /**
   * Active plugin footer panel id when recorded, if any.
   */
  activePluginFooterPanelId: string | null;
}

export interface NavigationState {
  collectionSettingsDirty: boolean;
  environmentSettingsDirty: boolean;
  folderSettingsDirty: boolean;
  showSidebar: boolean;
  showAiSidebar: boolean;
  showGitSidebar: boolean;
  showShortcutsSidebar: boolean;
  showRequestEditor: boolean;
  showResponseEditor: boolean;
  requestEditorSplitHeight: number;
  showConsole: boolean;
  showVariables: boolean;
  showMcp: boolean;
  showTerminal: boolean;
  activePluginFooterPanelId: string | null;
  /**
   * Active plugin sidebar panel id (`plugin:<pluginId>:<contributionId>`), or
   * `null` for the primary collections surface. The primary surface resolves to
   * a registered panel with `replaces: "collections"` when one exists; otherwise
   * it is the built-in Collections tree.
   */
  activeSidebarPanelId: string | null;
  /**
   * Last sidebar/footer layout captured by Hide sidebars; null until the first hide.
   */
  sidebarFooterLayoutSnapshot: SidebarFooterLayoutSnapshot | null;
  pendingPluginInstallId: string | null;
  pendingMarketplaceSearch: string | null;
  pendingInstalledSearch: string | null;
  pendingSnippetMarketplaceSearch: string | null;
  pendingSnippetInstallId: string | null;
  pendingTeamHubJoin: TeamHubJoinPayload | null;
  customThemesReloadNonce: number;
}

const initialState: NavigationState = {
  collectionSettingsDirty: false,
  environmentSettingsDirty: false,
  folderSettingsDirty: false,
  showSidebar: true,
  showAiSidebar: false,
  showGitSidebar: false,
  showShortcutsSidebar: false,
  showRequestEditor: true,
  showResponseEditor: true,
  requestEditorSplitHeight: 340,
  showConsole: false,
  showVariables: false,
  showMcp: false,
  showTerminal: false,
  activePluginFooterPanelId: null,
  activeSidebarPanelId: null,
  sidebarFooterLayoutSnapshot: null,
  pendingPluginInstallId: null,
  pendingMarketplaceSearch: null,
  pendingInstalledSearch: null,
  pendingSnippetMarketplaceSearch: null,
  pendingSnippetInstallId: null,
  pendingTeamHubJoin: null,
  customThemesReloadNonce: 0
};

const navigationSlice = createSlice({
  name: 'navigation',
  initialState,
  reducers: {
    /**
     * Sets the active switchable sidebar panel id, or null for the default sidebar.
     */
    setActiveSidebarPanel(state, action: PayloadAction<string | null>) {
      state.activeSidebarPanelId = action.payload;
    },
    /**
     * Stores or clears the session-only Hide sidebars layout snapshot.
     */
    setSidebarFooterLayoutSnapshot(
      state,
      action: PayloadAction<SidebarFooterLayoutSnapshot | null>
    ) {
      state.sidebarFooterLayoutSnapshot = action.payload;
    },
    /**
     * Tracks unsaved edits in collection settings.
     */
    setCollectionSettingsDirty(state, action: PayloadAction<boolean>) {
      state.collectionSettingsDirty = action.payload;
    },
    /**
     * Tracks unsaved edits in environment settings.
     */
    setEnvironmentSettingsDirty(state, action: PayloadAction<boolean>) {
      state.environmentSettingsDirty = action.payload;
    },
    /**
     * Tracks unsaved edits in folder settings.
     */
    setFolderSettingsDirty(state, action: PayloadAction<boolean>) {
      state.folderSettingsDirty = action.payload;
    },
    /**
     * Toggles sidebar visibility.
     */
    toggleSidebar(state) {
      state.showSidebar = !state.showSidebar;
    },
    /**
     * Sets sidebar visibility explicitly.
     */
    setShowSidebar(state, action: PayloadAction<boolean>) {
      state.showSidebar = action.payload;
    },
    /**
     * Toggles AI sidebar visibility and closes other right sidebars when opening.
     */
    toggleAiSidebar(state) {
      const next = !state.showAiSidebar;
      state.showAiSidebar = next;
      if (next) {
        state.showGitSidebar = false;
        state.showShortcutsSidebar = false;
      }
    },
    /**
     * Sets AI sidebar visibility explicitly and closes other right sidebars when opening.
     */
    setShowAiSidebar(state, action: PayloadAction<boolean>) {
      state.showAiSidebar = action.payload;
      if (action.payload) {
        state.showGitSidebar = false;
        state.showShortcutsSidebar = false;
      }
    },
    /**
     * Toggles Git sidebar visibility and closes other right sidebars when opening.
     */
    toggleGitSidebar(state) {
      const next = !state.showGitSidebar;
      state.showGitSidebar = next;
      if (next) {
        state.showAiSidebar = false;
        state.showShortcutsSidebar = false;
      }
    },
    /**
     * Sets Git sidebar visibility explicitly and closes other right sidebars when opening.
     */
    setShowGitSidebar(state, action: PayloadAction<boolean>) {
      state.showGitSidebar = action.payload;
      if (action.payload) {
        state.showAiSidebar = false;
        state.showShortcutsSidebar = false;
      }
    },
    /**
     * Opens the Git sidebar and closes other right sidebars.
     */
    openGitSidebar(state) {
      state.showGitSidebar = true;
      state.showAiSidebar = false;
      state.showShortcutsSidebar = false;
    },
    /**
     * Toggles Shortcuts sidebar visibility and closes other right sidebars when opening.
     */
    toggleShortcutsSidebar(state) {
      const next = !state.showShortcutsSidebar;
      state.showShortcutsSidebar = next;
      if (next) {
        state.showAiSidebar = false;
        state.showGitSidebar = false;
      }
    },
    /**
     * Sets Shortcuts sidebar visibility explicitly and closes other right sidebars when opening.
     */
    setShowShortcutsSidebar(state, action: PayloadAction<boolean>) {
      state.showShortcutsSidebar = action.payload;
      if (action.payload) {
        state.showAiSidebar = false;
        state.showGitSidebar = false;
      }
    },
    /**
     * Toggles request editor visibility while keeping at least one editor visible.
     */
    toggleRequestEditor(state) {
      if (state.showRequestEditor && !state.showResponseEditor) {
        return;
      }
      state.showRequestEditor = !state.showRequestEditor;
    },
    /**
     * Sets request editor visibility explicitly.
     */
    setShowRequestEditor(state, action: PayloadAction<boolean>) {
      state.showRequestEditor = action.payload;
    },
    /**
     * Toggles response editor visibility while keeping at least one editor visible.
     */
    toggleResponseEditor(state) {
      if (state.showResponseEditor && !state.showRequestEditor) {
        return;
      }
      state.showResponseEditor = !state.showResponseEditor;
    },
    /**
     * Sets response editor visibility explicitly.
     */
    setShowResponseEditor(state, action: PayloadAction<boolean>) {
      state.showResponseEditor = action.payload;
    },
    /**
     * Sets the request editor split height in pixels.
     */
    setRequestEditorSplitHeight(state, action: PayloadAction<number>) {
      state.requestEditorSplitHeight = action.payload;
    },
    /**
     * Toggles the footer console panel.
     */
    toggleConsole(state) {
      state.showConsole = !state.showConsole;
      if (state.showConsole) {
        state.showVariables = false;
        state.showMcp = false;
        state.showTerminal = false;
        state.activePluginFooterPanelId = null;
      }
    },
    /**
     * Sets footer console panel visibility explicitly.
     */
    setShowConsole(state, action: PayloadAction<boolean>) {
      state.showConsole = action.payload;
    },
    /**
     * Toggles the footer variables panel.
     */
    toggleVariables(state) {
      state.showVariables = !state.showVariables;
      if (state.showVariables) {
        state.showConsole = false;
        state.showMcp = false;
        state.showTerminal = false;
        state.activePluginFooterPanelId = null;
      }
    },
    /**
     * Sets footer variables panel visibility explicitly.
     */
    setShowVariables(state, action: PayloadAction<boolean>) {
      state.showVariables = action.payload;
    },
    /**
     * Toggles the footer MCP server panel.
     */
    toggleMcp(state) {
      state.showMcp = !state.showMcp;
      if (state.showMcp) {
        state.showConsole = false;
        state.showVariables = false;
        state.showTerminal = false;
        state.activePluginFooterPanelId = null;
      }
    },
    /**
     * Sets footer MCP server panel visibility explicitly.
     */
    setShowMcp(state, action: PayloadAction<boolean>) {
      state.showMcp = action.payload;
    },
    /**
     * Toggles the footer terminal panel.
     */
    toggleTerminal(state) {
      state.showTerminal = !state.showTerminal;
      if (state.showTerminal) {
        state.showConsole = false;
        state.showVariables = false;
        state.showMcp = false;
        state.activePluginFooterPanelId = null;
      }
    },
    /**
     * Sets footer terminal panel visibility explicitly.
     */
    setShowTerminal(state, action: PayloadAction<boolean>) {
      state.showTerminal = action.payload;
    },
    /**
     * Toggles one plugin footer panel and closes built-in footer panels.
     */
    togglePluginFooterPanel(state, action: PayloadAction<string>) {
      const nextId = state.activePluginFooterPanelId === action.payload ? null : action.payload;
      state.activePluginFooterPanelId = nextId;
      if (nextId) {
        state.showConsole = false;
        state.showVariables = false;
        state.showMcp = false;
        state.showTerminal = false;
      }
    },
    /**
     * Sets the active plugin footer panel id explicitly.
     */
    setActivePluginFooterPanelId(state, action: PayloadAction<string | null>) {
      state.activePluginFooterPanelId = action.payload;
    },
    /**
     * Queues a marketplace plugin install requested via harborclient:// deep link.
     */
    setPendingPluginInstall(state, action: PayloadAction<string>) {
      state.pendingPluginInstallId = action.payload;
    },
    /**
     * Clears a queued deep-link plugin install after it has been handled.
     */
    consumePendingPluginInstall(state) {
      state.pendingPluginInstallId = null;
    },
    /**
     * Queues a marketplace search query requested from global search navigation.
     */
    setPendingMarketplaceSearch(state, action: PayloadAction<string>) {
      state.pendingMarketplaceSearch = action.payload;
    },
    /**
     * Clears a queued marketplace search after the Plugins page has applied it.
     */
    consumePendingMarketplaceSearch(state) {
      state.pendingMarketplaceSearch = null;
    },
    /**
     * Queues an installed search query requested from global search navigation.
     */
    setPendingInstalledSearch(state, action: PayloadAction<string>) {
      state.pendingInstalledSearch = action.payload;
    },
    /**
     * Clears a queued installed search after the Plugins page has applied it.
     */
    consumePendingInstalledSearch(state) {
      state.pendingInstalledSearch = null;
    },
    /**
     * Queues a snippet marketplace search query requested from global search navigation.
     */
    setPendingSnippetMarketplaceSearch(state, action: PayloadAction<string>) {
      state.pendingSnippetMarketplaceSearch = action.payload;
    },
    /**
     * Clears a queued snippet marketplace search after the Snippets page has applied it.
     */
    consumePendingSnippetMarketplaceSearch(state) {
      state.pendingSnippetMarketplaceSearch = null;
    },
    /**
     * Queues a marketplace snippet install requested via harborclient:// deep link.
     */
    setPendingSnippetInstall(state, action: PayloadAction<string>) {
      state.pendingSnippetInstallId = action.payload;
    },
    /**
     * Clears a queued deep-link snippet install after it has been handled.
     */
    consumePendingSnippetInstall(state) {
      state.pendingSnippetInstallId = null;
    },
    /**
     * Queues a Team Hub join deep link for the onboarding modal.
     */
    setPendingTeamHubJoin(state, action: PayloadAction<TeamHubJoinPayload>) {
      state.pendingTeamHubJoin = action.payload;
    },
    /**
     * Clears a queued Team Hub join deep link after it has been handled.
     */
    consumePendingTeamHubJoin(state) {
      state.pendingTeamHubJoin = null;
    },
    /**
     * Bumps the custom themes reload nonce so the Themes screen refreshes installed themes.
     */
    bumpCustomThemesReloadNonce(state) {
      state.customThemesReloadNonce += 1;
    }
  }
});

export const {
  setActiveSidebarPanel,
  setSidebarFooterLayoutSnapshot,
  setCollectionSettingsDirty,
  setEnvironmentSettingsDirty,
  setFolderSettingsDirty,
  toggleSidebar,
  setShowSidebar,
  toggleAiSidebar,
  setShowAiSidebar,
  toggleGitSidebar,
  setShowGitSidebar,
  openGitSidebar,
  toggleShortcutsSidebar,
  setShowShortcutsSidebar,
  toggleRequestEditor,
  setShowRequestEditor,
  toggleResponseEditor,
  setShowResponseEditor,
  setRequestEditorSplitHeight,
  toggleConsole,
  setShowConsole,
  toggleVariables,
  setShowVariables,
  toggleMcp,
  setShowMcp,
  toggleTerminal,
  setShowTerminal,
  togglePluginFooterPanel,
  setActivePluginFooterPanelId,
  setPendingPluginInstall,
  consumePendingPluginInstall,
  setPendingMarketplaceSearch,
  consumePendingMarketplaceSearch,
  setPendingInstalledSearch,
  consumePendingInstalledSearch,
  setPendingSnippetMarketplaceSearch,
  consumePendingSnippetMarketplaceSearch,
  setPendingSnippetInstall,
  consumePendingSnippetInstall,
  setPendingTeamHubJoin,
  consumePendingTeamHubJoin,
  bumpCustomThemesReloadNonce
} = navigationSlice.actions;

/**
 * Returns whether collection settings have unsaved edits.
 */
export const selectCollectionSettingsDirty = (state: RootState): boolean =>
  state.navigation.collectionSettingsDirty;
/**
 * Returns whether environment settings have unsaved edits.
 */
export const selectEnvironmentSettingsDirty = (state: RootState): boolean =>
  state.navigation.environmentSettingsDirty;
/**
 * Returns whether folder settings have unsaved edits.
 */
export const selectFolderSettingsDirty = (state: RootState): boolean =>
  state.navigation.folderSettingsDirty;
/**
 * Returns the user sidebar visibility preference.
 */
export const selectShowSidebar = (state: RootState): boolean => state.navigation.showSidebar;
/**
 * Returns effective sidebar visibility for layout rendering.
 */
export const selectSidebarVisible = (state: RootState): boolean => state.navigation.showSidebar;
/**
 * Returns the user AI sidebar visibility preference.
 */
export const selectShowAiSidebar = (state: RootState): boolean => state.navigation.showAiSidebar;
/**
 * Returns effective AI sidebar visibility for layout rendering.
 */
export const selectAiSidebarVisible = (state: RootState): boolean => state.navigation.showAiSidebar;
/**
 * Returns the user Git sidebar visibility preference.
 */
export const selectShowGitSidebar = (state: RootState): boolean => state.navigation.showGitSidebar;
/**
 * Returns effective Git sidebar visibility for layout rendering.
 */
export const selectGitSidebarVisible = (state: RootState): boolean =>
  state.navigation.showGitSidebar;
/**
 * Returns the user Shortcuts sidebar visibility preference.
 */
export const selectShowShortcutsSidebar = (state: RootState): boolean =>
  state.navigation.showShortcutsSidebar;
/**
 * Returns effective Shortcuts sidebar visibility for layout rendering.
 */
export const selectShortcutsSidebarVisible = (state: RootState): boolean =>
  state.navigation.showShortcutsSidebar;
/**
 * Returns the user request editor visibility preference.
 */
export const selectShowRequestEditor = (state: RootState): boolean =>
  state.navigation.showRequestEditor;
/**
 * Returns the user response editor visibility preference.
 */
export const selectShowResponseEditor = (state: RootState): boolean =>
  state.navigation.showResponseEditor;
/**
 * Returns the persisted request editor split height in pixels.
 */
export const selectRequestEditorSplitHeight = (state: RootState): number =>
  state.navigation.requestEditorSplitHeight;
/**
 * Returns whether the console panel is open.
 */
export const selectShowConsole = (state: RootState): boolean => state.navigation.showConsole;
/**
 * Returns whether the variables panel is open.
 */
export const selectShowVariables = (state: RootState): boolean => state.navigation.showVariables;
/**
 * Returns whether the MCP server panel is open.
 */
export const selectShowMcp = (state: RootState): boolean => state.navigation.showMcp;
/**
 * Returns whether the terminal panel is open.
 */
export const selectShowTerminal = (state: RootState): boolean => state.navigation.showTerminal;
/**
 * Returns the active plugin footer panel id, if any.
 */
export const selectActivePluginFooterPanelId = (state: RootState): string | null =>
  state.navigation.activePluginFooterPanelId;
/**
 * Returns the active switchable sidebar panel id, if any.
 */
export const selectActiveSidebarPanelId = (state: RootState): string | null =>
  state.navigation.activeSidebarPanelId;
/**
 * Returns the session-only Hide sidebars layout snapshot, if one was recorded.
 */
export const selectSidebarFooterLayoutSnapshot = (
  state: RootState
): SidebarFooterLayoutSnapshot | null => state.navigation.sidebarFooterLayoutSnapshot;
/**
 * Returns the plugin id queued by a harborclient:// install deep link, if any.
 */
export const selectPendingPluginInstallId = (state: RootState): string | null =>
  state.navigation.pendingPluginInstallId;

/**
 * Returns the marketplace search query queued by global search navigation, if any.
 */
export const selectPendingMarketplaceSearch = (state: RootState): string | null =>
  state.navigation.pendingMarketplaceSearch;

/**
 * Returns the installed search query queued by global search navigation, if any.
 */
export const selectPendingInstalledSearch = (state: RootState): string | null =>
  state.navigation.pendingInstalledSearch;

/**
 * Returns the snippet marketplace search query queued by global search navigation, if any.
 */
export const selectPendingSnippetMarketplaceSearch = (state: RootState): string | null =>
  state.navigation.pendingSnippetMarketplaceSearch;

/**
 * Returns the snippet bundle id queued by a harborclient:// install deep link, if any.
 */
export const selectPendingSnippetInstallId = (state: RootState): string | null =>
  state.navigation.pendingSnippetInstallId;
/**
 * Returns the Team Hub join deep link queued for onboarding, if any.
 */
export const selectPendingTeamHubJoin = (
  state: RootState
): { baseUrl: string; code: string } | null => state.navigation.pendingTeamHubJoin;
/**
 * Returns the custom themes reload nonce used to refresh the Themes installed list.
 */
export const selectCustomThemesReloadNonce = (state: RootState): number =>
  state.navigation.customThemesReloadNonce;

export default navigationSlice.reducer;
