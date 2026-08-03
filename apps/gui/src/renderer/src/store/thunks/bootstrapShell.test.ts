import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSidebarExpansion } from '@harborclient/core/sidebarExpansion';
import { DEFAULT_REQUEST_EDITOR_SPLIT_HEIGHT } from '@harborclient/core/types';
import {
  peekPrefetchedSidebarExpansionForTests,
  resetSidebarExpansionPrefetchForTests
} from '#/renderer/src/store/sidebarExpansionPrefetch';
import { resetPanelLayoutHydratedForTests } from '#/renderer/src/store/panelLayoutHydration';
import { waitForPaint } from './bootstrapShell';

const hydrateOpenTabs = vi.fn(() => ({ type: 'tabs/hydrateOpenTabs' }));
const hydrateTerminalLayout = vi.fn(() => ({
  type: 'terminals/hydrateTerminalLayout'
}));
const refreshCollections = vi.fn(() => ({ type: 'collections/refresh' }));
const refreshEnvironments = vi.fn(() => ({ type: 'environments/refresh' }));
const refreshCollectionContents = vi.fn((id: number) => {
  void id;
  return { type: 'collections/refreshContents' };
});
const openSeededBuiltinRequestIfNeeded = vi.fn(() => ({
  type: 'collections/openSeededBuiltinRequestIfNeeded'
}));

vi.mock('./tabs', () => ({
  hydrateOpenTabs: (): { type: string } => hydrateOpenTabs()
}));
vi.mock('./terminals', () => ({
  hydrateTerminalLayout: (): { type: string } => hydrateTerminalLayout()
}));
vi.mock('./collections', () => ({
  refreshCollections: (): { type: string } => refreshCollections(),
  refreshCollectionContents: (id: number): { type: string } => refreshCollectionContents(id),
  openSeededBuiltinRequestIfNeeded: (): { type: string } => openSeededBuiltinRequestIfNeeded()
}));
vi.mock('./environments', () => ({
  refreshEnvironments: (): { type: string } => refreshEnvironments()
}));
vi.mock('#/renderer/src/plugins/themeRuntime', () => ({
  applyThemePreference: vi.fn(async () => undefined)
}));

describe('waitForPaint', () => {
  it('resolves after two animation frames', async () => {
    const original = globalThis.requestAnimationFrame;
    const raf = vi.fn((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    globalThis.requestAnimationFrame = raf as typeof requestAnimationFrame;

    try {
      await waitForPaint();
      expect(raf).toHaveBeenCalledTimes(2);
    } finally {
      if (original) {
        globalThis.requestAnimationFrame = original;
      } else {
        // Node test env may not define rAF; remove the stub.
        Reflect.deleteProperty(globalThis, 'requestAnimationFrame');
      }
    }
  });
});

describe('bootstrapShellForReveal', () => {
  const getSidebarExpansion = vi.fn(async () => ({
    ...defaultSidebarExpansion(),
    collectionIds: [42]
  }));
  const getPanelLayout = vi.fn(async () => ({
    showSidebar: true,
    showRail: true,
    showAiSidebar: false,
    showGitSidebar: false,
    showShortcutsSidebar: false,
    showRequestEditor: true,
    showResponseEditor: true,
    requestEditorSplitHeight: DEFAULT_REQUEST_EDITOR_SPLIT_HEIGHT,
    responseEditorSplit: null,
    showConsole: false,
    showVariables: false,
    showMcp: false,
    showTerminal: false,
    showLiveServerLogs: false,
    liveServerLogsPlacement: 'footer' as const,
    liveServerLogsPlacements: {},
    activePluginFooterPanelId: null
  }));
  const getGeneralSettings = vi.fn(async () => ({ requestTimeoutMs: 30_000 }));
  const getTheme = vi.fn(async () => 'system' as const);

  beforeEach(() => {
    resetPanelLayoutHydratedForTests();
    resetSidebarExpansionPrefetchForTests();
    hydrateOpenTabs.mockClear();
    hydrateTerminalLayout.mockClear();
    refreshCollections.mockClear();
    refreshEnvironments.mockClear();
    refreshCollectionContents.mockClear();
    openSeededBuiltinRequestIfNeeded.mockClear();
    getSidebarExpansion.mockClear();

    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined
    });
    vi.stubGlobal('window', {
      api: {
        getOpenTabsPayload: vi.fn(async () => null),
        getPanelLayout,
        setPanelLayout: vi.fn(async () => undefined),
        getGeneralSettings,
        getTheme,
        getSidebarExpansion
      }
    });
  });

  afterEach(() => {
    resetPanelLayoutHydratedForTests();
    resetSidebarExpansionPrefetchForTests();
    vi.unstubAllGlobals();
  });

  it('prefetches sidebar expansion before refreshing collections', async () => {
    const callOrder: string[] = [];
    getSidebarExpansion.mockImplementation(async () => {
      callOrder.push('sidebarExpansion');
      return { ...defaultSidebarExpansion(), collectionIds: [42] };
    });
    refreshCollections.mockImplementation(() => {
      callOrder.push('refreshCollections');
      expect(peekPrefetchedSidebarExpansionForTests()?.collectionIds).toEqual([42]);
      return { type: 'collections/refresh' };
    });

    const { bootstrapShellForReveal } = await import('./bootstrapShell');

    const getState = (): {
      collections: {
        collections: Array<{ id: number }>;
        selectedCollectionId: number;
      };
      tabs: {
        tabs: Array<{ tabId: string; draft: { collection_id: number; name: string; url: string } }>;
        activeTabId: string;
      };
      workflows: { dialogMode: 'closed' };
    } => ({
      collections: {
        collections: [{ id: 42 }],
        selectedCollectionId: 42
      },
      tabs: {
        tabs: [
          {
            tabId: 'tab-1',
            draft: {
              name: 'Untitled',
              url: '',
              collection_id: 42
            }
          }
        ],
        activeTabId: 'tab-1'
      },
      workflows: { dialogMode: 'closed' }
    });

    /**
     * Minimal thunk dispatch that unwraps nested functions and resolves promises.
     *
     * @param action - Redux action or thunk.
     */
    const dispatch = vi.fn(async (action: unknown) => {
      if (typeof action === 'function') {
        return (action as (d: typeof dispatch, g: typeof getState) => unknown)(dispatch, getState);
      }
      return action;
    });

    await bootstrapShellForReveal()(dispatch as never, getState as never, undefined as never);

    expect(callOrder.indexOf('sidebarExpansion')).toBeLessThan(
      callOrder.indexOf('refreshCollections')
    );
    expect(refreshCollectionContents).toHaveBeenCalledWith(42);
    expect(openSeededBuiltinRequestIfNeeded).toHaveBeenCalled();
  });
});
