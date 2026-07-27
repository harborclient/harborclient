// @vitest-environment jsdom
import { configureStore } from '@reduxjs/toolkit';
import { act, createElement, useEffect, type ComponentProps } from 'react';
import { Provider } from 'react-redux';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RootState } from '#/renderer/src/store/redux';
import settingsDraftReducer, {
  initSettingsDraft,
  setDraftGeneralField
} from '#/renderer/src/store/slices/settingsDraftSlice';
import { DEFAULT_GENERAL_SETTINGS } from '@harborclient/core/generalSettings';
import { DEFAULT_AI_SETTINGS } from '#/renderer/src/ui/Tabs/Settings/constants';

import type { BoundSettingId, SettingFieldState } from './useSettingFieldState';
import { useSettingFieldState } from './useSettingFieldState';

const toastSuccessMock = vi.hoisted(() => vi.fn());

vi.mock('react-hot-toast', () => ({
  default: {
    success: toastSuccessMock
  }
}));

/**
 * Builds a minimal Redux store containing only the settings draft slice.
 *
 * @returns Store preloaded with factory-default draft values.
 */
function createTestStore(): ReturnType<
  typeof configureStore<{ settingsDraft: ReturnType<typeof settingsDraftReducer> }>
> {
  const draft = settingsDraftReducer(
    undefined,
    initSettingsDraft({
      general: DEFAULT_GENERAL_SETTINGS,
      ai: DEFAULT_AI_SETTINGS
    })
  );

  return configureStore({
    reducer: {
      settingsDraft: settingsDraftReducer
    },
    preloadedState: {
      settingsDraft: draft
    }
  });
}

describe('useSettingFieldState', () => {
  let container: HTMLDivElement;
  let root: Root;
  let store: ReturnType<typeof createTestStore>;
  let latestState: SettingFieldState | null;

  /**
   * Fixture that mounts the hook and reports its return value to the test harness.
   *
   * @param props - Catalog id to bind.
   */
  function HookFixture({ settingId }: { settingId: BoundSettingId }): null {
    const state = useSettingFieldState(settingId);

    /**
     * Publishes the latest hook result after each render so tests can assert without DOM.
     */
    useEffect(() => {
      latestState = state;
    });

    return null;
  }

  /**
   * Renders the hook fixture under a Redux Provider.
   *
   * @param settingId - Catalog field or group id to pass to the hook.
   */
  function renderHookFixture(settingId: BoundSettingId): void {
    act(() => {
      // React 19's ProviderProps requires `children` in props, but eslint forbids
      // passing children as a prop to createElement. The third argument is equivalent.
      root.render(
        createElement(
          Provider,
          { store } as ComponentProps<typeof Provider>,
          createElement(HookFixture, { settingId })
        )
      );
    });
  }

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    store = createTestStore();
    latestState = null;
    toastSuccessMock.mockReset();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('tracks modified state for general.verifySsl draft changes', () => {
    renderHookFixture('general.verifySsl');
    expect(latestState?.isModified).toBe(false);

    act(() => {
      store.dispatch(setDraftGeneralField({ key: 'verifySsl', value: false }));
    });

    expect(latestState?.isModified).toBe(true);
    expect(latestState?.settingId).toBe('general.verifySsl');
  });

  it('tracks modified state for git.autoTrack group binding', () => {
    renderHookFixture('git.autoTrack');
    expect(latestState?.isModified).toBe(false);

    act(() => {
      store.dispatch(setDraftGeneralField({ key: 'gitAutoAdd', value: false }));
    });

    expect(latestState?.isModified).toBe(true);

    act(() => {
      latestState?.resetToDefault();
    });

    expect((store.getState() as RootState).settingsDraft.general.gitAutoAdd).toBe(true);
    expect(latestState?.isModified).toBe(false);
  });

  it('resetToDefault restores the factory default for general.verifySsl', () => {
    act(() => {
      store.dispatch(setDraftGeneralField({ key: 'verifySsl', value: false }));
    });

    renderHookFixture('general.verifySsl');
    expect(latestState?.isModified).toBe(true);

    act(() => {
      latestState?.resetToDefault();
    });

    expect((store.getState() as RootState).settingsDraft.general.verifySsl).toBe(true);
    expect(latestState?.isModified).toBe(false);
  });

  it('resetToDefault does not dispatch saveSettingsDraft', () => {
    act(() => {
      store.dispatch(setDraftGeneralField({ key: 'verifySsl', value: false }));
    });

    renderHookFixture('general.verifySsl');

    const dispatchedTypes: string[] = [];
    const originalDispatch = store.dispatch.bind(store);
    store.dispatch = ((action: unknown) => {
      if (typeof action === 'object' && action !== null && 'type' in action) {
        dispatchedTypes.push(String((action as { type: string }).type));
      }
      return originalDispatch(action as never);
    }) as typeof store.dispatch;

    act(() => {
      latestState?.resetToDefault();
    });

    expect(dispatchedTypes.some((type) => type.startsWith('settingsDraft/save'))).toBe(false);
    expect((store.getState() as RootState).settingsDraft.general.verifySsl).toBe(true);
  });

  it('copySettingId writes the catalog id and shows a success toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      clipboard: { writeText }
    });

    renderHookFixture('general.verifySsl');

    await act(async () => {
      await latestState?.copySettingId();
    });

    expect(writeText).toHaveBeenCalledWith('general.verifySsl');
    expect(toastSuccessMock).toHaveBeenCalledWith('Copied to clipboard');
  });

  it('copySettingAsJson and copyDeepLink write JSON and hash snippets', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      clipboard: { writeText }
    });

    act(() => {
      store.dispatch(setDraftGeneralField({ key: 'verifySsl', value: false }));
    });
    renderHookFixture('general.verifySsl');

    await act(async () => {
      await latestState?.copySettingAsJson();
    });
    expect(writeText).toHaveBeenCalledWith('"general.verifySsl": false');

    await act(async () => {
      await latestState?.copyDeepLink();
    });
    expect(writeText).toHaveBeenCalledWith('#setting-general-verifySsl');
  });

  it('treats unbound ids as not modified and no-ops reset/copy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      clipboard: { writeText }
    });

    const before = structuredClone(store.getState().settingsDraft);

    renderHookFixture('ai.enterToSend');
    expect(latestState?.isModified).toBe(false);

    act(() => {
      latestState?.resetToDefault();
    });
    expect(store.getState().settingsDraft).toEqual(before);

    await act(async () => {
      await latestState?.copySettingId();
      await latestState?.copySettingAsJson();
      await latestState?.copyDeepLink();
    });
    expect(writeText).not.toHaveBeenCalled();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });
});
