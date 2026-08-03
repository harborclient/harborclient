import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppDispatch } from '#/renderer/src/store/redux';
import settingsDraftReducer, {
  selectSettingsDraftDirty,
  setDraftGeneralField,
  setDraftMcpServerEnabled
} from '#/renderer/src/store/slices/settingsDraftSlice';
import settingsReducer from '#/renderer/src/store/slices/settingsSlice';
import { loadSettingsDraft, saveSettingsDraft } from './settingsDraft';
import { DEFAULT_GENERAL_SETTINGS } from '@harborclient/core/generalSettings';
import { DEFAULT_AI_SETTINGS } from '#/renderer/src/ui/Tabs/Settings/constants';

const DEFAULT_MCP_SERVER = {
  enabled: false,
  running: false,
  name: 'HarborClient',
  logoUrl: 'https://harborclient.com/images/logo.png',
  host: '127.0.0.1',
  port: 7333,
  token: 'test-token',
  exposedTools: [],
  keepLogs: true
};

const apiMock = vi.hoisted(() => ({
  getGeneralSettings: vi.fn(),
  getAiSettings: vi.fn(),
  getMcpServerSettings: vi.fn(),
  setGeneralSettings: vi.fn(),
  setAiSettings: vi.fn(),
  setMcpServerSettings: vi.fn()
}));

vi.stubGlobal('window', { api: apiMock });

describe('settingsDraft thunks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.getMcpServerSettings.mockResolvedValue(DEFAULT_MCP_SERVER);
    apiMock.setMcpServerSettings.mockResolvedValue(DEFAULT_MCP_SERVER);
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
    expect(draft.mcpServerEnabled).toBe(false);
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
    expect(apiMock.setMcpServerSettings).toHaveBeenCalledWith({
      ...DEFAULT_MCP_SERVER,
      enabled: false,
      running: false
    });
    expect(selectSettingsDraftDirty(store.getState() as never)).toBe(false);
  });

  it('stops MCP listen intent before other settings when disabling the feature', async () => {
    apiMock.getGeneralSettings.mockResolvedValue(DEFAULT_GENERAL_SETTINGS);
    apiMock.getAiSettings.mockResolvedValue(DEFAULT_AI_SETTINGS);
    apiMock.getMcpServerSettings.mockResolvedValue({
      ...DEFAULT_MCP_SERVER,
      enabled: true,
      running: true
    });

    const store = configureStore({
      reducer: {
        settingsDraft: settingsDraftReducer,
        settings: settingsReducer
      }
    });
    const dispatch = store.dispatch as AppDispatch;

    await dispatch(loadSettingsDraft());
    dispatch(setDraftMcpServerEnabled(false));

    const callOrder: string[] = [];
    apiMock.setMcpServerSettings.mockImplementation(async (settings) => {
      callOrder.push('mcp');
      return settings;
    });
    apiMock.setGeneralSettings.mockImplementation(async () => {
      callOrder.push('general');
    });
    apiMock.setAiSettings.mockImplementation(async () => {
      callOrder.push('ai');
    });

    await dispatch(saveSettingsDraft());

    expect(apiMock.setMcpServerSettings).toHaveBeenCalledWith({
      ...DEFAULT_MCP_SERVER,
      enabled: false,
      running: false
    });
    expect(callOrder[0]).toBe('mcp');
    expect(callOrder.slice(1).sort()).toEqual(['ai', 'general']);
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
