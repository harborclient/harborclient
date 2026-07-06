import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '#/renderer/src/store/redux';

export interface NavigationState {
  collectionSettingsDirty: boolean;
  environmentSettingsDirty: boolean;
  showSidebar: boolean;
  showAiSidebar: boolean;
  showRequestEditor: boolean;
  showResponseEditor: boolean;
  requestEditorSplitHeight: number;
  showConsole: boolean;
  showVariables: boolean;
  showMcp: boolean;
  activePluginFooterPanelId: string | null;
  activeSidebarPanelId: string | null;
  pendingPluginInstallId: string | null;
  pendingMarketplaceSearch: string | null;
  pendingInstalledSearch: string | null;
}

const initialState: NavigationState = {
  collectionSettingsDirty: false,
  environmentSettingsDirty: false,
  showSidebar: true,
  showAiSidebar: false,
  showRequestEditor: true,
  showResponseEditor: true,
  requestEditorSplitHeight: 340,
  showConsole: false,
  showVariables: false,
  showMcp: false,
  activePluginFooterPanelId: null,
  activeSidebarPanelId: null,
  pendingPluginInstallId: null,
  pendingMarketplaceSearch: null,
  pendingInstalledSearch: null
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
     * Toggles AI sidebar visibility.
     */
    toggleAiSidebar(state) {
      state.showAiSidebar = !state.showAiSidebar;
    },
    /**
     * Sets AI sidebar visibility explicitly.
     */
    setShowAiSidebar(state, action: PayloadAction<boolean>) {
      state.showAiSidebar = action.payload;
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
        state.activePluginFooterPanelId = null;
      }
    },
    /**
     * Toggles the footer variables panel.
     */
    toggleVariables(state) {
      state.showVariables = !state.showVariables;
      if (state.showVariables) {
        state.showConsole = false;
        state.showMcp = false;
        state.activePluginFooterPanelId = null;
      }
    },
    /**
     * Toggles the footer MCP server panel.
     */
    toggleMcp(state) {
      state.showMcp = !state.showMcp;
      if (state.showMcp) {
        state.showConsole = false;
        state.showVariables = false;
        state.activePluginFooterPanelId = null;
      }
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
      }
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
    }
  }
});

export const {
  setActiveSidebarPanel,
  setCollectionSettingsDirty,
  setEnvironmentSettingsDirty,
  toggleSidebar,
  setShowSidebar,
  toggleAiSidebar,
  setShowAiSidebar,
  toggleRequestEditor,
  setShowRequestEditor,
  toggleResponseEditor,
  setShowResponseEditor,
  setRequestEditorSplitHeight,
  toggleConsole,
  toggleVariables,
  toggleMcp,
  togglePluginFooterPanel,
  setPendingPluginInstall,
  consumePendingPluginInstall,
  setPendingMarketplaceSearch,
  consumePendingMarketplaceSearch,
  setPendingInstalledSearch,
  consumePendingInstalledSearch
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

export default navigationSlice.reducer;
