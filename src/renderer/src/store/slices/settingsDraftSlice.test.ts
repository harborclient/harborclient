import { describe, expect, it } from 'vitest';

import {
  DEFAULT_AI_SETTINGS,
  DEFAULT_GENERAL_SETTINGS
} from '#/renderer/src/ui/Settings/constants';
import settingsDraftReducer, {
  initSettingsDraft,
  selectSettingsDraftDirty,
  setDraftGeneralField
} from '#/renderer/src/store/slices/settingsDraftSlice';
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
        ai: DEFAULT_AI_SETTINGS
      })
    );

    expect(selectSettingsDraftDirty(buildState(state))).toBe(false);
  });

  it('marks the draft dirty when a value changes', () => {
    let state = settingsDraftReducer(
      undefined,
      initSettingsDraft({
        general: DEFAULT_GENERAL_SETTINGS,
        ai: DEFAULT_AI_SETTINGS
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
        ai: DEFAULT_AI_SETTINGS
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
        ai: DEFAULT_AI_SETTINGS
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
        ai: DEFAULT_AI_SETTINGS
      })
    );

    state = settingsDraftReducer(
      state,
      setDraftGeneralField({ key: 'requestTimeoutMs', value: 120000 })
    );

    expect(state.general.requestTimeoutMs).toBe(120000);
    expect(selectSettingsDraftDirty(buildState(state))).toBe(true);
  });
});
