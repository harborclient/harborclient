import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  normalizeCodeEditorFontSize,
  normalizeCodeEditorSetup,
  normalizeCodeEditorTheme
} from '@harborclient/core/codeEditorSettings';
import {
  DEFAULT_GENERAL_SETTINGS,
  normalizeTerminalSettings
} from '@harborclient/core/generalSettings';
import type {
  AiSettings,
  CodeEditorSetup,
  GeneralSettings,
  ProxySettings,
  TerminalSettings
} from '@harborclient/core/types';
import type { RootState } from '#/renderer/src/store/redux';
import { DEFAULT_AI_SETTINGS } from '#/renderer/src/ui/Tabs/Settings/constants';

/**
 * Snapshot of persisted settings values used for dirty detection.
 */
export interface SettingsDraftBaseline {
  general: GeneralSettings;
  ai: AiSettings;
  /**
   * Whether the local MCP server should listen after save.
   */
  mcpServerEnabled: boolean;
}

export interface SettingsDraftState {
  general: GeneralSettings;
  ai: AiSettings;
  /**
   * Draft enable flag for the local MCP server (bind/token live in the footer panel).
   */
  mcpServerEnabled: boolean;
  baseline: SettingsDraftBaseline | null;
  loading: boolean;
  saving: boolean;
  loadError: string | null;
}

const initialState: SettingsDraftState = {
  general: structuredClone(DEFAULT_GENERAL_SETTINGS),
  ai: structuredClone(DEFAULT_AI_SETTINGS),
  mcpServerEnabled: false,
  baseline: null,
  loading: false,
  saving: false,
  loadError: null
};

/**
 * Returns true when two draft snapshots are equivalent.
 *
 * @param left - First snapshot.
 * @param right - Second snapshot.
 */
function draftSnapshotsEqual(left: SettingsDraftBaseline, right: SettingsDraftBaseline): boolean {
  return (
    JSON.stringify(left.general) === JSON.stringify(right.general) &&
    JSON.stringify(left.ai) === JSON.stringify(right.ai) &&
    left.mcpServerEnabled === right.mcpServerEnabled
  );
}

/**
 * Applies shared CodeMirror normalizers so draft and baseline share the same shape.
 *
 * @param general - Raw general settings from persistence or IPC.
 */
function normalizeDraftGeneral(general: GeneralSettings): GeneralSettings {
  return {
    ...general,
    codeEditorTheme: normalizeCodeEditorTheme(general.codeEditorTheme),
    codeEditorSetup: normalizeCodeEditorSetup(general.codeEditorSetup),
    codeEditorFontSize: normalizeCodeEditorFontSize(general.codeEditorFontSize),
    terminal: normalizeTerminalSettings(general.terminal)
  };
}

const settingsDraftSlice = createSlice({
  name: 'settingsDraft',
  initialState,
  reducers: {
    /**
     * Marks the draft as loading from persistence.
     */
    setSettingsDraftLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    /**
     * Marks the draft as saving to persistence.
     */
    setSettingsDraftSaving(state, action: PayloadAction<boolean>) {
      state.saving = action.payload;
    },
    /**
     * Stores a load failure message for form sections.
     */
    setSettingsDraftLoadError(state, action: PayloadAction<string | null>) {
      state.loadError = action.payload;
    },
    /**
     * Replaces draft values and baseline after a successful load or save.
     */
    initSettingsDraft(
      state,
      action: PayloadAction<{
        general: GeneralSettings;
        ai: AiSettings;
        mcpServerEnabled: boolean;
      }>
    ) {
      const general = normalizeDraftGeneral(structuredClone(action.payload.general));
      const ai = structuredClone(action.payload.ai);
      const mcpServerEnabled = action.payload.mcpServerEnabled;
      state.general = general;
      state.ai = ai;
      state.mcpServerEnabled = mcpServerEnabled;
      state.baseline = {
        general: structuredClone(general),
        ai: structuredClone(ai),
        mcpServerEnabled
      };
      state.loadError = null;
    },
    /**
     * Updates a top-level general settings field in the draft.
     */
    setDraftGeneralField<K extends keyof GeneralSettings>(
      state: SettingsDraftState,
      action: PayloadAction<{ key: K; value: GeneralSettings[K] }>
    ) {
      state.general[action.payload.key] = action.payload.value;
    },
    /**
     * Updates a proxy settings field nested under general settings.
     */
    setDraftProxyField<K extends keyof ProxySettings>(
      state: SettingsDraftState,
      action: PayloadAction<{ key: K; value: ProxySettings[K] }>
    ) {
      state.general.proxy[action.payload.key] = action.payload.value;
    },
    /**
     * Updates the CodeMirror theme in the draft.
     */
    setDraftCodeEditorTheme(state, action: PayloadAction<GeneralSettings['codeEditorTheme']>) {
      state.general.codeEditorTheme = action.payload;
    },
    /**
     * Updates one CodeMirror setup flag in the draft.
     */
    setDraftCodeEditorSetupField(
      state,
      action: PayloadAction<{ key: keyof CodeEditorSetup; value: boolean }>
    ) {
      state.general.codeEditorSetup[action.payload.key] = action.payload.value;
    },
    /**
     * Updates one footer terminal xterm.js option in the draft.
     */
    setDraftTerminalField<K extends keyof TerminalSettings>(
      state: SettingsDraftState,
      action: PayloadAction<{ key: K; value: TerminalSettings[K] }>
    ) {
      state.general.terminal[action.payload.key] = action.payload.value;
    },
    /**
     * Updates an AI settings field in the draft.
     */
    setDraftAiField<K extends keyof AiSettings>(
      state: SettingsDraftState,
      action: PayloadAction<{ key: K; value: AiSettings[K] }>
    ) {
      state.ai[action.payload.key] = action.payload.value;
    },
    /**
     * Updates the draft MCP server enable flag (persisted with the page Save action).
     */
    setDraftMcpServerEnabled(state, action: PayloadAction<boolean>) {
      state.mcpServerEnabled = action.payload;
    },
    /**
     * Resets the entire draft to the last loaded/saved baseline snapshot.
     *
     * Per-field reset via `resetFieldToDefault` (VS Code–style) is the primary
     * UI path. This action is for programmatic full revert and has no Settings
     * UI control today.
     */
    resetSettingsDraftToBaseline(state) {
      if (state.baseline == null) {
        return;
      }
      state.general = structuredClone(state.baseline.general);
      state.ai = structuredClone(state.baseline.ai);
      state.mcpServerEnabled = state.baseline.mcpServerEnabled;
    }
  }
});

export const {
  setSettingsDraftLoading,
  setSettingsDraftSaving,
  setSettingsDraftLoadError,
  initSettingsDraft,
  setDraftGeneralField,
  setDraftProxyField,
  setDraftCodeEditorTheme,
  setDraftCodeEditorSetupField,
  setDraftTerminalField,
  setDraftAiField,
  setDraftMcpServerEnabled,
  resetSettingsDraftToBaseline
} = settingsDraftSlice.actions;

/**
 * Returns true while draft values are being loaded from persistence.
 */
export const selectSettingsDraftLoading = (state: RootState): boolean =>
  state.settingsDraft.loading;

/**
 * Returns true while draft values are being saved.
 */
export const selectSettingsDraftSaving = (state: RootState): boolean => state.settingsDraft.saving;

/**
 * Returns the draft load error message, if any.
 */
export const selectSettingsDraftLoadError = (state: RootState): string | null =>
  state.settingsDraft.loadError;

/**
 * Returns true when draft values differ from the loaded baseline.
 */
export const selectSettingsDraftDirty = (state: RootState): boolean => {
  const { baseline, general, ai, mcpServerEnabled } = state.settingsDraft;
  if (baseline == null) {
    return false;
  }
  return !draftSnapshotsEqual(baseline, { general, ai, mcpServerEnabled });
};

/**
 * Returns true when draft controls should be disabled.
 */
export const selectSettingsDraftDisabled = (state: RootState): boolean =>
  state.settingsDraft.loading || state.settingsDraft.saving;

/**
 * Returns the draft general settings object.
 */
export const selectDraftGeneral = (state: RootState): GeneralSettings =>
  state.settingsDraft.general;

/**
 * Returns the draft AI settings object.
 */
export const selectDraftAi = (state: RootState): AiSettings => state.settingsDraft.ai;

/**
 * Returns the draft MCP server enable flag.
 */
export const selectDraftMcpServerEnabled = (state: RootState): boolean =>
  state.settingsDraft.mcpServerEnabled;

/**
 * Returns proxy settings from the draft general settings object.
 */
export const selectDraftProxy = (state: RootState): ProxySettings =>
  state.settingsDraft.general.proxy;

export default settingsDraftSlice.reducer;
