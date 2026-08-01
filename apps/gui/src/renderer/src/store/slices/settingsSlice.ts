import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { DEFAULT_GENERAL_SETTINGS } from '@harborclient/core/generalSettings';
import type {
  CodeEditorSetup,
  CodeEditorTheme,
  GeneralSettings,
  TerminalSettings
} from '@harborclient/core/types';
import type { RootState } from '#/renderer/src/store/redux';

/**
 * Renderer copy of factory general settings (same object as core defaults).
 */
export const defaultGeneralSettings = DEFAULT_GENERAL_SETTINGS;

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

/**
 * Returns footer terminal xterm.js options from general settings.
 */
export const selectTerminalSettings = (state: RootState): TerminalSettings =>
  state.settings.general.terminal;

export default settingsSlice.reducer;
