import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  DEFAULT_CODE_EDITOR_FONT_SIZE,
  DEFAULT_CODE_EDITOR_SETUP
} from '#/shared/codeEditorSettings';
import type { CodeEditorSetup, CodeEditorTheme, GeneralSettings } from '#/shared/types';
import type { RootState } from '#/renderer/src/store/redux';

export const defaultGeneralSettings: GeneralSettings = {
  requestTimeoutMs: 30000,
  scriptTimeoutMs: 5000,
  allowScriptNetworkRequests: false,
  allowedNetworkPlugins: [],
  maxResponseSizeMb: 50,
  verifySsl: true,
  followRedirects: true,
  scrollbarAutoHide: false,
  wrapTabs: true,
  closeToTray: false,
  spellCheckEnabled: true,
  warnWhenSwitchingThemes: true,
  warnWhenExitingWithUnsavedChanges: true,
  warnWhenClosingUnsavedRequests: true,
  warnWhenEditingSnippet: true,
  warnWhenCloningSnippet: true,
  warnWhenClickingReadonlySnippet: true,
  warnWhenCreatingTabGroup: true,
  warnWhenOpeningTabGroup: true,
  warnWhenAgentUsesTerminal: true,
  gitAutoAdd: true,
  externalMergeEditorPath: '',
  gitCommitAuthorName: '',
  gitCommitAuthorEmail: '',
  gitCommitAuthorPrompted: false,
  codeEditorTheme: 'default',
  codeEditorSetup: { ...DEFAULT_CODE_EDITOR_SETUP },
  codeEditorFontSize: DEFAULT_CODE_EDITOR_FONT_SIZE,
  proxy: {
    enabled: false,
    protocol: 'http',
    host: '',
    port: 8080,
    authEnabled: false,
    username: '',
    password: ''
  },
  globalVariables: [],
  logFilePath: ''
};

export interface SettingsState {
  general: GeneralSettings;
}

const initialState: SettingsState = {
  general: defaultGeneralSettings
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    /**
     * Replaces persisted general settings in the renderer store.
     */
    setGeneralSettingsState(state, action: PayloadAction<GeneralSettings>) {
      state.general = action.payload;
    }
  }
});

export const { setGeneralSettingsState } = settingsSlice.actions;

/**
 * Returns the active CodeMirror theme from general settings.
 */
export const selectCodeEditorTheme = (state: RootState): CodeEditorTheme =>
  state.settings.general.codeEditorTheme;

/**
 * Returns CodeMirror basicSetup options for editable editors.
 */
export const selectCodeEditorSetup = (state: RootState): CodeEditorSetup =>
  state.settings.general.codeEditorSetup;

/**
 * Returns the active CodeMirror font size from general settings.
 */
export const selectCodeEditorFontSize = (state: RootState): string =>
  state.settings.general.codeEditorFontSize;

/**
 * Returns whether custom OverlayScrollbars handles should auto-hide when idle.
 */
export const selectScrollbarAutoHide = (state: RootState): boolean =>
  state.settings.general.scrollbarAutoHide;

/**
 * Returns whether open request tabs and AI chat tabs should wrap instead of scrolling horizontally.
 */
export const selectWrapTabs = (state: RootState): boolean => state.settings.general.wrapTabs;

export default settingsSlice.reducer;
