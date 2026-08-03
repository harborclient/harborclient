import { describe, expect, it } from 'vitest';

import { DEFAULT_GENERAL_SETTINGS } from '@harborclient/core/generalSettings';
import { DEFAULT_AI_SETTINGS } from '#/renderer/src/ui/Tabs/Settings/constants';
import settingsDraftReducer, {
  initSettingsDraft,
  selectSettingsDraftDirty,
  setDraftGeneralField
} from './settingsDraftSlice';
import type { RootState } from '#/renderer/src/store/redux';

/**
 * Builds a minimal root state containing only the settings draft slice.
 */
function buildState(draft: ReturnType<typeof settingsDraftReducer>): RootState {
  return {
    settingsDraft: draft
  } as RootState;
}

describe('settingsDraftSlice', () => {
  it('starts clean after initialization', () => {
    const state = settingsDraftReducer(
      undefined,
      initSettingsDraft({
        general: DEFAULT_GENERAL_SETTINGS,
        ai: DEFAULT_AI_SETTINGS,
        mcpServerEnabled: false
      })
    );

    expect(selectSettingsDraftDirty(buildState(state))).toBe(false);
  });

  it('marks the draft dirty when a value changes', () => {
    let state = settingsDraftReducer(
      undefined,
      initSettingsDraft({
        general: DEFAULT_GENERAL_SETTINGS,
        ai: DEFAULT_AI_SETTINGS,
        mcpServerEnabled: false
      })
    );

    state = settingsDraftReducer(
      state,
      setDraftGeneralField({ key: 'requestTimeoutMs', value: 60_000 })
    );

    expect(selectSettingsDraftDirty(buildState(state))).toBe(true);
  });

  it('marks the draft dirty when codeEditorFontSize changes', () => {
    let state = settingsDraftReducer(
      undefined,
      initSettingsDraft({
        general: DEFAULT_GENERAL_SETTINGS,
        ai: DEFAULT_AI_SETTINGS,
        mcpServerEnabled: false
      })
    );

    state = settingsDraftReducer(
      state,
      setDraftGeneralField({ key: 'codeEditorFontSize', value: '18px' })
    );

    expect(state.general.codeEditorFontSize).toBe('18px');
    expect(selectSettingsDraftDirty(buildState(state))).toBe(true);
  });

  it('normalizes codeEditorFontSize when initializing the draft', () => {
    const state = settingsDraftReducer(
      undefined,
      initSettingsDraft({
        general: { ...DEFAULT_GENERAL_SETTINGS, codeEditorFontSize: '10px' },
        ai: DEFAULT_AI_SETTINGS,
        mcpServerEnabled: false
      })
    );

    expect(state.general.codeEditorFontSize).toBe('14px');
    expect(state.baseline?.general.codeEditorFontSize).toBe('14px');
    expect(selectSettingsDraftDirty(buildState(state))).toBe(false);
  });

  it('updates general settings fields in the draft', () => {
    let state = settingsDraftReducer(
      undefined,
      initSettingsDraft({
        general: DEFAULT_GENERAL_SETTINGS,
        ai: DEFAULT_AI_SETTINGS,
        mcpServerEnabled: false
      })
    );

    state = settingsDraftReducer(
      state,
      setDraftGeneralField({ key: 'requestTimeoutMs', value: 120000 })
    );

    expect(state.general.requestTimeoutMs).toBe(120000);
    expect(selectSettingsDraftDirty(buildState(state))).toBe(true);
  });

  it('stays clean when loaded value differs from factory default', () => {
    const state = settingsDraftReducer(
      undefined,
      initSettingsDraft({
        general: { ...DEFAULT_GENERAL_SETTINGS, verifySsl: false },
        ai: DEFAULT_AI_SETTINGS,
        mcpServerEnabled: false
      })
    );

    expect(state.general.verifySsl).toBe(false);
    expect(state.baseline?.general.verifySsl).toBe(false);
    expect(selectSettingsDraftDirty(buildState(state))).toBe(false);
  });

  it('becomes dirty when a field is reset toward the factory default', () => {
    let state = settingsDraftReducer(
      undefined,
      initSettingsDraft({
        general: { ...DEFAULT_GENERAL_SETTINGS, verifySsl: false },
        ai: DEFAULT_AI_SETTINGS,
        mcpServerEnabled: false
      })
    );

    expect(selectSettingsDraftDirty(buildState(state))).toBe(false);

    state = settingsDraftReducer(
      state,
      setDraftGeneralField({ key: 'verifySsl', value: DEFAULT_GENERAL_SETTINGS.verifySsl })
    );

    expect(state.general.verifySsl).toBe(true);
    expect(state.baseline?.general.verifySsl).toBe(false);
    expect(selectSettingsDraftDirty(buildState(state))).toBe(true);
  });
});
