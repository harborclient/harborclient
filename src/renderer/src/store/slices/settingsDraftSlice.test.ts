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
