import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppDispatch } from '#/renderer/src/store/redux';
import settingsDraftReducer, {
  selectSettingsDraftDirty,
  setDraftGeneralField
} from '#/renderer/src/store/slices/settingsDraftSlice';
import settingsReducer from '#/renderer/src/store/slices/settingsSlice';
import { loadSettingsDraft, saveSettingsDraft } from '#/renderer/src/store/thunks/settingsDraft';
import {
  DEFAULT_AI_SETTINGS,
  DEFAULT_GENERAL_SETTINGS
} from '#/renderer/src/ui/Tabs/Settings/constants';

const apiMock = vi.hoisted(() => ({
  getGeneralSettings: vi.fn(),
  getAiSettings: vi.fn(),
  setGeneralSettings: vi.fn(),
  setAiSettings: vi.fn()
}));

vi.stubGlobal('window', { api: apiMock });

describe('settingsDraft thunks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads general and ai values into the draft', async () => {
    apiMock.getGeneralSettings.mockResolvedValue(DEFAULT_GENERAL_SETTINGS);
    apiMock.getAiSettings.mockResolvedValue(DEFAULT_AI_SETTINGS);

    const store = configureStore({
      reducer: {
        settingsDraft: settingsDraftReducer,
        settings: settingsReducer
      }
    });
    const dispatch = store.dispatch as AppDispatch;

    await dispatch(loadSettingsDraft());

    const draft = store.getState().settingsDraft;
    expect(draft.general).toEqual(DEFAULT_GENERAL_SETTINGS);
    expect(draft.ai).toEqual(DEFAULT_AI_SETTINGS);
    expect(draft.loading).toBe(false);
    expect(draft.loadError).toBeNull();
    expect(selectSettingsDraftDirty(store.getState() as never)).toBe(false);
  });

  it('persists draft values and clears dirty state on save', async () => {
    apiMock.getGeneralSettings.mockResolvedValue(DEFAULT_GENERAL_SETTINGS);
    apiMock.getAiSettings.mockResolvedValue(DEFAULT_AI_SETTINGS);
    apiMock.setGeneralSettings.mockResolvedValue(undefined);
    apiMock.setAiSettings.mockResolvedValue(undefined);

    const store = configureStore({
      reducer: {
        settingsDraft: settingsDraftReducer,
        settings: settingsReducer
      }
    });
    const dispatch = store.dispatch as AppDispatch;

    await dispatch(loadSettingsDraft());
    dispatch(setDraftGeneralField({ key: 'requestTimeoutMs', value: 60_000 }));

    await dispatch(saveSettingsDraft());

    expect(apiMock.setGeneralSettings).toHaveBeenCalled();
    expect(apiMock.setAiSettings).toHaveBeenCalled();
    expect(selectSettingsDraftDirty(store.getState() as never)).toBe(false);
  });

  it('does not overwrite unsaved draft edits when a stale load completes', async () => {
    apiMock.getGeneralSettings.mockResolvedValue(DEFAULT_GENERAL_SETTINGS);
    apiMock.getAiSettings.mockResolvedValue(DEFAULT_AI_SETTINGS);

    const store = configureStore({
      reducer: {
        settingsDraft: settingsDraftReducer,
        settings: settingsReducer
      }
    });
    const dispatch = store.dispatch as AppDispatch;

    await dispatch(loadSettingsDraft());
    dispatch(setDraftGeneralField({ key: 'codeEditorFontSize', value: '18px' }));
    expect(selectSettingsDraftDirty(store.getState() as never)).toBe(true);

    await dispatch(loadSettingsDraft());

    expect(store.getState().settingsDraft.general.codeEditorFontSize).toBe('18px');
    expect(selectSettingsDraftDirty(store.getState() as never)).toBe(true);
  });
});
