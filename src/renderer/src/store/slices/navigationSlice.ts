import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { SettingsSection } from '#/shared/types';
import type { RootState } from '#/renderer/src/store/redux';

/**
 * Which main-area view is currently shown. Overlays are mutually exclusive.
 */
export type MainView =
  | { type: 'request' }
  | { type: 'settings' }
  | { type: 'service-hubs' }
  | { type: 'certificates' }
  | { type: 'collection'; id: number }
  | { type: 'environment'; id: number };

export interface NavigationState {
  mainView: MainView;
  collectionSettingsDirty: boolean;
  environmentSettingsDirty: boolean;
  showSidebar: boolean;
  showAiSidebar: boolean;
  showConsole: boolean;
  showVariables: boolean;
  settingsSection: SettingsSection;
}

const initialState: NavigationState = {
  mainView: { type: 'request' },
  collectionSettingsDirty: false,
  environmentSettingsDirty: false,
  showSidebar: true,
  showAiSidebar: false,
  showConsole: false,
  showVariables: false,
  settingsSection: 'general'
};

/**
 * Resets dirty flags when switching overlays so a new settings form starts clean.
 */
function resetDirtyFlags(state: NavigationState): void {
  state.collectionSettingsDirty = false;
  state.environmentSettingsDirty = false;
}

const navigationSlice = createSlice({
  name: 'navigation',
  initialState,
  reducers: {
    /**
     * Shows the settings overlay and clears dirty flags.
     */
    openSettings(state, action: PayloadAction<SettingsSection | undefined>) {
      resetDirtyFlags(state);
      state.mainView = { type: 'settings' };
      state.settingsSection = action.payload ?? 'general';
    },
    /**
     * Shows the service hubs overlay and clears dirty flags.
     */
    openServiceHubs(state) {
      resetDirtyFlags(state);
      state.mainView = { type: 'service-hubs' };
    },
    /**
     * Shows the certificates overlay and clears dirty flags.
     */
    openCertificates(state) {
      resetDirtyFlags(state);
      state.mainView = { type: 'certificates' };
    },
    /**
     * Shows collection settings for the given id.
     */
    openCollectionSettings(state, action: PayloadAction<number>) {
      resetDirtyFlags(state);
      state.mainView = { type: 'collection', id: action.payload };
    },
    /**
     * Shows environment settings for the given id.
     */
    openEnvironmentSettings(state, action: PayloadAction<number>) {
      resetDirtyFlags(state);
      state.mainView = { type: 'environment', id: action.payload };
    },
    /**
     * Returns to the request editor and clears dirty flags.
     */
    closeOverlay(state) {
      resetDirtyFlags(state);
      state.mainView = { type: 'request' };
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
     * Toggles AI sidebar visibility.
     */
    toggleAiSidebar(state) {
      state.showAiSidebar = !state.showAiSidebar;
    },
    /**
     * Toggles the footer console panel.
     */
    toggleConsole(state) {
      state.showConsole = !state.showConsole;
      if (state.showConsole) {
        state.showVariables = false;
      }
    },
    /**
     * Toggles the footer variables panel.
     */
    toggleVariables(state) {
      state.showVariables = !state.showVariables;
      if (state.showVariables) {
        state.showConsole = false;
      }
    }
  }
});

export const {
  openSettings,
  openServiceHubs,
  openCertificates,
  openCollectionSettings,
  openEnvironmentSettings,
  closeOverlay,
  setCollectionSettingsDirty,
  setEnvironmentSettingsDirty,
  toggleSidebar,
  toggleAiSidebar,
  toggleConsole,
  toggleVariables
} = navigationSlice.actions;

/**
 * Returns the current main-area view.
 */
export const selectMainView = (state: RootState): MainView => state.navigation.mainView;
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
 * Returns the user AI sidebar visibility preference.
 */
export const selectShowAiSidebar = (state: RootState): boolean => state.navigation.showAiSidebar;
/**
 * Returns whether the console panel is open.
 */
export const selectShowConsole = (state: RootState): boolean => state.navigation.showConsole;
/**
 * Returns whether the variables panel is open.
 */
export const selectShowVariables = (state: RootState): boolean => state.navigation.showVariables;
/**
 * Returns the settings section to show when the settings overlay is open.
 */
export const selectSettingsSection = (state: RootState): SettingsSection =>
  state.navigation.settingsSection;

/**
 * Sidebar is hidden when app settings, service hubs, or certificates are open, even if the
 * user has not toggled it off manually.
 */
export const selectSidebarVisible = (state: RootState): boolean => {
  const { mainView, showSidebar } = state.navigation;
  return (
    showSidebar &&
    mainView.type !== 'settings' &&
    mainView.type !== 'service-hubs' &&
    mainView.type !== 'certificates'
  );
};

/**
 * AI sidebar is hidden when app settings, service hubs, or certificates are open, even if the
 * user has not toggled it off manually.
 */
export const selectAiSidebarVisible = (state: RootState): boolean => {
  const { mainView, showAiSidebar } = state.navigation;
  return (
    showAiSidebar &&
    mainView.type !== 'settings' &&
    mainView.type !== 'service-hubs' &&
    mainView.type !== 'certificates'
  );
};

export default navigationSlice.reducer;
