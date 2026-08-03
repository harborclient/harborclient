import { createAsyncThunk } from '@reduxjs/toolkit';

import { setGeneralSettingsState } from '#/renderer/src/store/slices/settingsSlice';
import {
  initSettingsDraft,
  selectSettingsDraftDirty,
  setSettingsDraftLoadError,
  setSettingsDraftLoading,
  setSettingsDraftSaving
} from '#/renderer/src/store/slices/settingsDraftSlice';
import type { ThunkApiConfig } from '#/renderer/src/store/redux';
import {
  normalizeCodeEditorFontSize,
  normalizeCodeEditorSetup,
  normalizeCodeEditorTheme
} from '@harborclient/core/codeEditorSettings';
import { normalizeTerminalSettings } from '@harborclient/core/generalSettings';
import type { GeneralSettings } from '@harborclient/core/types';
import { notifyMcpServerStatusChanged } from '#/renderer/src/hooks/useMcpServerStatus';

/** Monotonic token so only the latest settings load may commit to the draft. */
let settingsDraftLoadGeneration = 0;

/**
 * Normalizes CodeMirror- and terminal-related general settings before persistence.
 *
 * @param general - Draft general settings about to be saved.
 */
function normalizeDraftGeneralForSave(general: GeneralSettings): GeneralSettings {
  return {
    ...general,
    codeEditorTheme: normalizeCodeEditorTheme(general.codeEditorTheme),
    codeEditorSetup: normalizeCodeEditorSetup(general.codeEditorSetup),
    codeEditorFontSize: normalizeCodeEditorFontSize(general.codeEditorFontSize),
    terminal: normalizeTerminalSettings(general.terminal)
  };
}

/**
 * Loads general, AI, and MCP enable settings into the shared settings draft.
 */
export const loadSettingsDraft = createAsyncThunk<void, void, ThunkApiConfig>(
  'settingsDraft/load',
  async (_arg, { dispatch, getState }) => {
    const generation = ++settingsDraftLoadGeneration;
    dispatch(setSettingsDraftLoading(true));
    dispatch(setSettingsDraftLoadError(null));
    try {
      const [general, ai, mcpServer] = await Promise.all([
        window.api.getGeneralSettings(),
        window.api.getAiSettings(),
        window.api.getMcpServerSettings()
      ]);
      if (generation !== settingsDraftLoadGeneration) {
        return;
      }
      if (selectSettingsDraftDirty(getState())) {
        return;
      }
      dispatch(
        initSettingsDraft({
          general,
          ai,
          mcpServerEnabled: mcpServer.enabled
        })
      );
    } catch (err) {
      if (generation !== settingsDraftLoadGeneration) {
        return;
      }
      dispatch(
        setSettingsDraftLoadError(err instanceof Error ? err.message : 'Failed to load settings.')
      );
    } finally {
      if (generation === settingsDraftLoadGeneration) {
        dispatch(setSettingsDraftLoading(false));
      }
    }
  }
);

/**
 * Persists the shared settings draft and refreshes renderer state that depends on it.
 */
export const saveSettingsDraft = createAsyncThunk<void, void, ThunkApiConfig>(
  'settingsDraft/save',
  async (_arg, { dispatch, getState }) => {
    const { general, ai, mcpServerEnabled } = getState().settingsDraft;
    const normalizedGeneral = normalizeDraftGeneralForSave(general);
    dispatch(setSettingsDraftSaving(true));
    dispatch(setSettingsDraftLoadError(null));
    try {
      const currentMcp = await window.api.getMcpServerSettings();
      const nextMcp = {
        ...currentMcp,
        enabled: mcpServerEnabled,
        // Disabling clears listen intent so re-enabling does not auto-start.
        running: mcpServerEnabled ? currentMcp.running : false
      };

      if (!mcpServerEnabled) {
        // Stop the HTTP listener first when turning the feature off.
        await window.api.setMcpServerSettings(nextMcp);
        await Promise.all([
          window.api.setGeneralSettings(normalizedGeneral),
          window.api.setAiSettings(ai)
        ]);
      } else {
        await Promise.all([
          window.api.setGeneralSettings(normalizedGeneral),
          window.api.setAiSettings(ai),
          window.api.setMcpServerSettings(nextMcp)
        ]);
      }
      dispatch(
        initSettingsDraft({
          general: normalizedGeneral,
          ai,
          mcpServerEnabled
        })
      );
      dispatch(setGeneralSettingsState(normalizedGeneral));
      notifyMcpServerStatusChanged();
    } catch (err) {
      dispatch(
        setSettingsDraftLoadError(err instanceof Error ? err.message : 'Failed to save settings.')
      );
      throw err;
    } finally {
      dispatch(setSettingsDraftSaving(false));
    }
  }
);
