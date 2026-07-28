import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_REQUEST_EDITOR_SPLIT_HEIGHT,
  type PanelLayoutState
} from '@harborclient/core/types';
import {
  hydratePanelLayoutFromSettings,
  isPanelLayoutHydrated,
  resetPanelLayoutHydratedForTests
} from './panelLayoutHydration';

/**
 * Builds a panel layout fixture for hydration tests.
 *
 * @param overrides - Fields to replace on the default layout.
 * @returns Complete panel layout state.
 */
function panelLayout(overrides: Partial<PanelLayoutState> = {}): PanelLayoutState {
  return {
    showSidebar: true,
    showAiSidebar: false,
    showGitSidebar: false,
    showShortcutsSidebar: false,
    showRequestEditor: true,
    showResponseEditor: true,
    requestEditorSplitHeight: DEFAULT_REQUEST_EDITOR_SPLIT_HEIGHT,
    showConsole: false,
    showVariables: false,
    showMcp: false,
    showTerminal: false,
    activePluginFooterPanelId: null,
    ...overrides
  };
}

describe('panelLayoutHydration', () => {
  const getPanelLayout = vi.fn();
  const setPanelLayout = vi.fn(async () => undefined);
  const dispatch = vi.fn();

  beforeEach(() => {
    resetPanelLayoutHydratedForTests();
    getPanelLayout.mockReset();
    setPanelLayout.mockReset();
    dispatch.mockReset();
    getPanelLayout.mockResolvedValue(panelLayout({ showConsole: true, showTerminal: true }));
    vi.stubGlobal('window', {
      api: {
        getPanelLayout,
        setPanelLayout
      }
    });
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined
    });
  });

  afterEach(() => {
    resetPanelLayoutHydratedForTests();
    vi.unstubAllGlobals();
  });

  it('hydrates panel layout from IPC once', async () => {
    await hydratePanelLayoutFromSettings(dispatch);

    expect(getPanelLayout).toHaveBeenCalledTimes(1);
    expect(isPanelLayoutHydrated()).toBe(true);
    expect(dispatch).toHaveBeenCalled();
  });

  it('skips a second hydration call after the first completes', async () => {
    await hydratePanelLayoutFromSettings(dispatch);
    await hydratePanelLayoutFromSettings(dispatch);

    expect(getPanelLayout).toHaveBeenCalledTimes(1);
  });
});
