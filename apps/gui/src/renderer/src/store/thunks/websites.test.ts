import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultAuth } from '@harborclient/core/auth';
import type { Website } from '@harborclient/core/types';
import type { AppDispatch } from '#/renderer/src/store/redux';
import modalsReducer, { type ModalsState } from '#/renderer/src/store/slices/modalsSlice';
import tabsReducer, {
  bindBrowserTabToWebsite,
  newBrowserTab,
  updateBrowserNavigation,
  type TabsState
} from '#/renderer/src/store/slices/tabsSlice';
import websitesReducer, { setWebsites } from '#/renderer/src/store/slices/websitesSlice';
import { isBrowserTab } from '#/renderer/src/store/tabs';
import {
  canReuseTabFaviconForUrl,
  createLivePageFromModal,
  maybePersistWebsiteFaviconFromNavigation,
  openAddLivePageModalWithPrefill,
  openConfiguredBrowserTab,
  openWebsiteSettings,
  websiteNameFromTab
} from './websites';

// react-hot-toast pulls in the DOM at import time; stub it for the Node test env.
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

/**
 * Builds a minimal website entity for thunk tests.
 *
 * @param overrides - Optional field overrides.
 * @returns Website with deterministic ids and empty scripts.
 */
function sampleWebsite(overrides: Partial<Website> = {}): Website {
  return {
    id: 7,
    uuid: 'website-uuid-7',
    name: 'Example',
    url: 'https://example.com/',
    homeUrl: 'https://example.com/',
    faviconDataUrl: null,
    scripts: [],
    preRequestScripts: [],
    postRequestScripts: [],
    variables: [],
    headers: [],
    userAgent: '',
    auth: defaultAuth(),
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  };
}

/**
 * Store with websites + tabs (+ optional modals) slices for thunk coverage.
 *
 * @param options - Whether to include the modals slice, and optional Start webpage URL.
 * @returns Typed dispatch and state accessors.
 */
function createTestStore(options?: { withModals?: boolean; startWebpageUrl?: string }): {
  dispatch: AppDispatch;
  getTabs: () => TabsState;
  getModals: () => ModalsState | undefined;
  getState: () => {
    websites: { items: Website[] };
    tabs: TabsState;
    modals?: ModalsState;
  };
} {
  const startWebpageUrl = options?.startWebpageUrl ?? 'about:blank';
  const store = configureStore({
    reducer: {
      websites: websitesReducer,
      tabs: tabsReducer,
      snippets: () => ({ snippets: [] }),
      collections: () => ({
        collections: [],
        selectedCollectionId: null,
        foldersByCollection: {},
        requestsByCollection: {}
      }),
      environments: () => ({
        environments: [],
        activeEnvironmentId: null
      }),
      settings: () => ({
        general: { globalVariables: [], startWebpageUrl }
      }),
      navigation: () => ({
        showConsole: false,
        showVariables: false,
        showMcp: false,
        showTerminal: false,
        showLiveServerLogs: false,
        liveServerLogsPlacement: 'footer' as const
      }),
      ...(options?.withModals ? { modals: modalsReducer } : {})
    }
  });
  return {
    dispatch: store.dispatch as AppDispatch,
    getTabs: (): TabsState => (store.getState() as { tabs: TabsState }).tabs,
    getModals: (): ModalsState | undefined => (store.getState() as { modals?: ModalsState }).modals,
    getState: () =>
      store.getState() as {
        websites: { items: Website[] };
        tabs: TabsState;
        modals?: ModalsState;
      }
  };
}

beforeEach(() => {
  vi.stubGlobal('window', {
    api: {
      createWebsite: vi.fn(),
      browserLoadURL: vi.fn().mockResolvedValue(undefined),
      browserSetScripts: vi.fn().mockResolvedValue(undefined)
    }
  });
});

describe('websiteNameFromTab', () => {
  it('prefers a meaningful page title', () => {
    expect(websiteNameFromTab('Example Domain', 'https://example.com/')).toBe('Example Domain');
  });

  it('falls back to hostname when title is a placeholder', () => {
    expect(websiteNameFromTab('New Browser', 'https://example.com/path')).toBe('example.com');
    expect(websiteNameFromTab('Browser', 'https://docs.harborclient.com/')).toBe(
      'docs.harborclient.com'
    );
  });

  it('falls back to New Browser when url has no hostname', () => {
    expect(websiteNameFromTab('New Browser', 'about:blank')).toBe('New Browser');
  });
});

describe('canReuseTabFaviconForUrl', () => {
  it('allows same-origin http(s) urls', () => {
    expect(canReuseTabFaviconForUrl('https://example.com/a', 'https://example.com/b')).toBe(true);
  });

  it('rejects cross-origin and non-http urls', () => {
    expect(canReuseTabFaviconForUrl('https://example.com/', 'https://other.example.com/')).toBe(
      false
    );
    expect(canReuseTabFaviconForUrl('about:blank', 'https://example.com/')).toBe(false);
  });
});

describe('openWebsiteSettings', () => {
  it('opens settings without activating the live page browser tab', async () => {
    const { dispatch, getTabs } = createTestStore();
    dispatch(setWebsites([sampleWebsite()]));
    dispatch(
      newBrowserTab({
        tabId: 'keep-focused',
        url: 'https://other.example.com/',
        homeUrl: 'https://other.example.com/'
      })
    );
    const previousActiveId = getTabs().activeTabId;

    await dispatch(openWebsiteSettings(7));

    const { tabs, activeTabId } = getTabs();
    const browserTab = tabs.find((tab) => isBrowserTab(tab) && tab.websiteId === 7);
    expect(browserTab).toBeDefined();
    if (!browserTab || !isBrowserTab(browserTab)) {
      throw new Error('expected browser tab');
    }

    expect(activeTabId).toBe(previousActiveId);
    expect(activeTabId).not.toBe(browserTab.tabId);
    expect(browserTab.settingsPanelOpen).toBe(true);
  });
});

describe('openConfiguredBrowserTab', () => {
  it('opens an unlinked browser tab at the configured start webpage URL', () => {
    const { dispatch, getTabs } = createTestStore({
      startWebpageUrl: 'https://start.example.com/home'
    });

    dispatch(openConfiguredBrowserTab());

    const { tabs, activeTabId } = getTabs();
    const browserTab = tabs.find((tab) => isBrowserTab(tab) && tab.tabId === activeTabId);
    expect(browserTab).toBeDefined();
    if (!browserTab || !isBrowserTab(browserTab)) {
      throw new Error('expected browser tab');
    }

    expect(browserTab.url).toBe('https://start.example.com/home');
    expect(browserTab.homeUrl).toBe('https://start.example.com/home');
    expect(browserTab.websiteId).toBeNull();
  });

  it('falls back to about:blank when start webpage is empty', () => {
    const { dispatch, getTabs } = createTestStore({ startWebpageUrl: '   ' });

    dispatch(openConfiguredBrowserTab());

    const { tabs, activeTabId } = getTabs();
    const browserTab = tabs.find((tab) => isBrowserTab(tab) && tab.tabId === activeTabId);
    expect(browserTab).toBeDefined();
    if (!browserTab || !isBrowserTab(browserTab)) {
      throw new Error('expected browser tab');
    }

    expect(browserTab.url).toBe('about:blank');
    expect(browserTab.homeUrl).toBe('about:blank');
  });
});

describe('openAddLivePageModalWithPrefill', () => {
  it('prefills name and url from the focused browser tab', () => {
    const { dispatch, getState } = createTestStore({ withModals: true });
    dispatch(
      newBrowserTab({
        tabId: 'browser-prefill',
        url: 'https://example.com/page',
        homeUrl: 'https://example.com/'
      })
    );
    dispatch(openAddLivePageModalWithPrefill());

    const modal = getState().modals?.addLivePageModal;
    expect(modal).not.toBeNull();
    expect(modal?.url).toBe('https://example.com/page');
    expect(modal?.name.length).toBeGreaterThan(0);
  });

  it('leaves name and url blank when no browser tab is focused', () => {
    const { dispatch, getState } = createTestStore({ withModals: true });
    dispatch(openAddLivePageModalWithPrefill());

    const modal = getState().modals?.addLivePageModal;
    expect(modal).not.toBeNull();
    expect(modal?.name).toBe('');
    expect(modal?.url).toBe('');
  });

  it('clears about:blank urls when prefilling', () => {
    const { dispatch, getState } = createTestStore({ withModals: true });
    dispatch(
      newBrowserTab({
        tabId: 'browser-blank',
        url: 'about:blank',
        homeUrl: 'about:blank'
      })
    );
    dispatch(openAddLivePageModalWithPrefill());

    const modal = getState().modals?.addLivePageModal;
    expect(modal?.url).toBe('');
  });
});

describe('createLivePageFromModal', () => {
  it('binds the focused unlinked browser tab without opening another tab', async () => {
    const createWebsiteMock = vi
      .fn()
      .mockImplementation(
        async (input: {
          uuid?: string;
          name: string;
          url: string;
          faviconDataUrl?: string | null;
        }) => [
          sampleWebsite({
            id: 99,
            uuid: input.uuid ?? 'created-uuid',
            name: input.name,
            url: input.url,
            homeUrl: input.url,
            faviconDataUrl: input.faviconDataUrl ?? null
          })
        ]
      );
    vi.stubGlobal('window', {
      api: {
        createWebsite: createWebsiteMock,
        browserLoadURL: vi.fn().mockResolvedValue(undefined),
        browserSetScripts: vi.fn().mockResolvedValue(undefined)
      }
    });

    const { dispatch, getTabs } = createTestStore();
    dispatch(
      newBrowserTab({
        tabId: 'browser-bind',
        url: 'https://docs.example.com/',
        homeUrl: 'https://docs.example.com/'
      })
    );
    dispatch(
      updateBrowserNavigation({
        tabId: 'browser-bind',
        url: 'https://docs.example.com/',
        title: 'Docs',
        canGoBack: false,
        canGoForward: false,
        faviconDataUrl: 'data:image/png;base64,abc',
        securityState: 'secure'
      })
    );

    await dispatch(
      createLivePageFromModal({
        name: 'Docs',
        url: 'https://docs.example.com/',
        connectionId: 'local'
      })
    ).unwrap();

    expect(createWebsiteMock).toHaveBeenCalledTimes(1);
    expect(createWebsiteMock.mock.calls[0]?.[0].faviconDataUrl).toBe('data:image/png;base64,abc');
    const { tabs } = getTabs();
    const browserTabs = tabs.filter(isBrowserTab);
    expect(browserTabs).toHaveLength(1);
    expect(browserTabs[0]?.websiteId).toBe(99);
    expect(browserTabs[0]?.websiteUuid).toBe(createWebsiteMock.mock.calls[0]?.[0].uuid);
  });

  it('does not reuse a tab favicon for a different origin url', async () => {
    const createWebsiteMock = vi
      .fn()
      .mockImplementation(
        async (input: {
          uuid?: string;
          name: string;
          url: string;
          faviconDataUrl?: string | null;
        }) => [
          sampleWebsite({
            id: 88,
            uuid: input.uuid ?? 'created-uuid',
            name: input.name,
            url: input.url,
            homeUrl: input.url,
            faviconDataUrl: input.faviconDataUrl ?? null
          })
        ]
      );
    vi.stubGlobal('window', {
      api: {
        createWebsite: createWebsiteMock,
        browserLoadURL: vi.fn().mockResolvedValue(undefined),
        browserSetScripts: vi.fn().mockResolvedValue(undefined)
      }
    });

    const { dispatch } = createTestStore();
    dispatch(
      newBrowserTab({
        tabId: 'browser-other-origin',
        url: 'https://docs.example.com/',
        homeUrl: 'https://docs.example.com/'
      })
    );
    dispatch(
      updateBrowserNavigation({
        tabId: 'browser-other-origin',
        url: 'https://docs.example.com/',
        title: 'Docs',
        canGoBack: false,
        canGoForward: false,
        faviconDataUrl: 'data:image/png;base64,abc',
        securityState: 'secure'
      })
    );

    await dispatch(
      createLivePageFromModal({
        name: 'Other',
        url: 'https://other.example.com/'
      })
    ).unwrap();

    expect(createWebsiteMock.mock.calls[0]?.[0].faviconDataUrl).toBeNull();
  });

  it('opens a browser tab when no unlinked browser tab is focused', async () => {
    const createWebsiteMock = vi
      .fn()
      .mockImplementation(async (input: { uuid?: string; name: string; url: string }) => [
        sampleWebsite({
          id: 55,
          uuid: input.uuid ?? 'opened-uuid',
          name: input.name,
          url: input.url,
          homeUrl: input.url
        })
      ]);
    vi.stubGlobal('window', {
      api: {
        createWebsite: createWebsiteMock,
        browserLoadURL: vi.fn().mockResolvedValue(undefined),
        browserSetScripts: vi.fn().mockResolvedValue(undefined)
      }
    });

    const { dispatch, getTabs } = createTestStore();

    await dispatch(
      createLivePageFromModal({
        name: 'Opened',
        url: 'https://opened.example.com/'
      })
    ).unwrap();

    const { tabs, activeTabId } = getTabs();
    const browserTab = tabs.find((tab) => isBrowserTab(tab) && tab.websiteId === 55);
    expect(browserTab).toBeDefined();
    expect(activeTabId).toBe(browserTab?.tabId);
  });
});

describe('maybePersistWebsiteFaviconFromNavigation', () => {
  it('persists a late favicon onto the linked live page on the saved origin', async () => {
    const updateWebsiteMock = vi
      .fn()
      .mockImplementation(async (input: { id: number; faviconDataUrl?: string | null }) => [
        sampleWebsite({
          id: input.id,
          faviconDataUrl: input.faviconDataUrl ?? null
        })
      ]);
    vi.stubGlobal('window', {
      api: {
        createWebsite: vi.fn(),
        updateWebsite: updateWebsiteMock,
        browserLoadURL: vi.fn().mockResolvedValue(undefined),
        browserSetScripts: vi.fn().mockResolvedValue(undefined)
      }
    });

    const { dispatch, getState } = createTestStore();
    dispatch(setWebsites([sampleWebsite({ id: 7, faviconDataUrl: null })]));
    dispatch(
      newBrowserTab({
        tabId: 'browser-favicon',
        url: 'https://example.com/',
        homeUrl: 'https://example.com/'
      })
    );
    dispatch(
      bindBrowserTabToWebsite({
        tabId: 'browser-favicon',
        websiteId: 7,
        websiteUuid: 'website-uuid-7'
      })
    );
    dispatch(
      updateBrowserNavigation({
        tabId: 'browser-favicon',
        url: 'https://example.com/',
        title: 'Example',
        canGoBack: false,
        canGoForward: false,
        faviconDataUrl: 'data:image/png;base64,xyz',
        securityState: 'secure'
      })
    );

    dispatch(
      maybePersistWebsiteFaviconFromNavigation('browser-favicon', 'data:image/png;base64,xyz')
    );

    await vi.waitFor(() => {
      expect(updateWebsiteMock).toHaveBeenCalledTimes(1);
    });
    expect(updateWebsiteMock.mock.calls[0]?.[0].faviconDataUrl).toBe('data:image/png;base64,xyz');
    expect(getState().websites.items[0]?.faviconDataUrl).toBe('data:image/png;base64,xyz');
  });
});
