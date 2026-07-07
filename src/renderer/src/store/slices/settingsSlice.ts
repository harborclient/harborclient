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
  warnWhenSwitchingThemes: true,
  warnWhenEditingSnippet: true,
  warnWhenCloningSnippet: true,
  warnWhenClickingReadonlySnippet: true,
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
  globalVariables: []
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

export default settingsSlice.reducer;
