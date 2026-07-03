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
} from '#/shared/codeEditorSettings';
import type { GeneralSettings } from '#/shared/types';

/** Monotonic token so only the latest settings load may commit to the draft. */
let settingsDraftLoadGeneration = 0;

/**
 * Normalizes CodeMirror-related general settings before persistence.
 *
 * @param general - Draft general settings about to be saved.
 */
function normalizeDraftGeneralForSave(general: GeneralSettings): GeneralSettings {
  return {
    ...general,
    codeEditorTheme: normalizeCodeEditorTheme(general.codeEditorTheme),
    codeEditorSetup: normalizeCodeEditorSetup(general.codeEditorSetup),
    codeEditorFontSize: normalizeCodeEditorFontSize(general.codeEditorFontSize)
  };
}

/**
 * Loads general and AI settings into the shared settings draft.
 */
export const loadSettingsDraft = createAsyncThunk<void, void, ThunkApiConfig>(
  'settingsDraft/load',
  async (_arg, { dispatch, getState }) => {
    const generation = ++settingsDraftLoadGeneration;
    dispatch(setSettingsDraftLoading(true));
    dispatch(setSettingsDraftLoadError(null));
    try {
      const [general, ai] = await Promise.all([
        window.api.getGeneralSettings(),
        window.api.getAiSettings()
      ]);
      if (generation !== settingsDraftLoadGeneration) {
        return;
      }
      if (selectSettingsDraftDirty(getState())) {
        return;
      }
      dispatch(initSettingsDraft({ general, ai }));
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
    const { general, ai } = getState().settingsDraft;
    const normalizedGeneral = normalizeDraftGeneralForSave(general);
    dispatch(setSettingsDraftSaving(true));
    dispatch(setSettingsDraftLoadError(null));
    try {
      await Promise.all([
        window.api.setGeneralSettings(normalizedGeneral),
        window.api.setAiSettings(ai)
      ]);
      dispatch(initSettingsDraft({ general: normalizedGeneral, ai }));
      dispatch(setGeneralSettingsState(normalizedGeneral));
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
