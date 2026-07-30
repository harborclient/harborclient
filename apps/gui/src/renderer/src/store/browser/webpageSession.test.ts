// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configureStore,
  type EnhancedStore,
  type ThunkDispatch,
  type UnknownAction
} from '@reduxjs/toolkit';
import tabsReducer, {
  newBrowserTab,
  setActiveTab,
  type TabsState
} from '#/renderer/src/store/slices/tabsSlice';
import {
  closeWebpageTab,
  focusWebpageTab,
  isWebpageSessionError,
  openOrReuseWebpageTab,
  screenshotWebpage,
  type WebpageSessionContext
} from './webpageSession';
import { resetBrowserGuestRegistryForTests } from '#/renderer/src/ui/Main/RequestEditor/BrowserTab/browserGuestRegistry';
import type { RootState } from '#/renderer/src/store/redux';
import type { Tab } from '#/renderer/src/store/tabs';

/**
 * Builds a minimal Redux store for webpage session tests.
 *
 * @returns Store with the tabs reducer.
 */
function createTestStore(): EnhancedStore<{ tabs: TabsState }> {
  return configureStore({
    reducer: {
      tabs: tabsReducer
    }
  });
}

/**
 * Adapts a minimal tabs-only store to the webpage session context shape.
 *
 * @param store - Test store from {@link createTestStore}.
 * @returns Webpage session context.
 */
function sessionContext(store: EnhancedStore<{ tabs: TabsState }>): WebpageSessionContext {
  return {
    getState: () => store.getState() as unknown as RootState,
    dispatch: store.dispatch as ThunkDispatch<RootState, unknown, UnknownAction>
  };
}

describe('webpageSession', () => {
  beforeEach(() => {
    resetBrowserGuestRegistryForTests();
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        browserCreate: vi.fn(async () => undefined),
        browserWaitForLoad: vi.fn(async () => ({
          tabId: 'ignored',
          url: 'https://example.com/',
          title: 'Example',
          canGoBack: false,
          canGoForward: false
        })),
        browserRequestClose: vi.fn(async () => true),
        browserQuerySelector: vi.fn(),
        browserExecuteJavaScript: vi.fn(),
        browserInsertCSS: vi.fn(),
        browserCapturePage: vi.fn(async () => ({
          dataUrl: 'data:image/png;base64,abc',
          pngBase64: 'abc'
        }))
      }
    });
  });

  it('returns an error when there is no active browser tab and no url', async () => {
    const store = createTestStore();
    const result = await openOrReuseWebpageTab(sessionContext(store));
    expect(isWebpageSessionError(result)).toBe(true);
    if (isWebpageSessionError(result)) {
      expect(result.error).toBe('No active browser tab.');
    }
  });

  it('reuses a matching open tab and focuses it', async () => {
    const store = createTestStore();
    store.dispatch(
      newBrowserTab({
        tabId: 'tab-existing',
        url: 'https://example.com/',
        homeUrl: 'https://example.com/'
      })
    );
    store.dispatch(newBrowserTab({ tabId: 'other', url: 'about:blank', homeUrl: 'about:blank' }));

    const result = await openOrReuseWebpageTab(sessionContext(store), {
      url: 'https://example.com'
    });

    expect(isWebpageSessionError(result)).toBe(false);
    if (!isWebpageSessionError(result)) {
      expect(result.tabId).toBe('tab-existing');
    }
    expect(store.getState().tabs.activeTabId).toBe('tab-existing');
    expect(window.api.browserCreate).not.toHaveBeenCalled();
  });

  it('opens a new tab when reuse is false', async () => {
    const store = createTestStore();
    store.dispatch(
      newBrowserTab({
        tabId: 'tab-existing',
        url: 'https://example.com/',
        homeUrl: 'https://example.com/'
      })
    );

    const result = await openOrReuseWebpageTab(sessionContext(store), {
      url: 'https://example.com',
      reuse: false
    });

    expect(isWebpageSessionError(result)).toBe(false);
    if (!isWebpageSessionError(result)) {
      expect(result.tabId).not.toBe('tab-existing');
      expect(result.url).toBe('https://example.com/');
    }
    expect(window.api.browserCreate).toHaveBeenCalled();
    expect(window.api.browserWaitForLoad).toHaveBeenCalled();
  });

  it('focuses and closes an open tab', async () => {
    const store = createTestStore();
    store.dispatch(
      newBrowserTab({
        tabId: 'tab-1',
        url: 'https://example.com/',
        homeUrl: 'https://example.com/'
      })
    );
    store.dispatch(setActiveTab('tab-1'));

    const focus = focusWebpageTab(sessionContext(store), 'tab-1');
    expect(focus).toEqual({ ok: true });

    const closed = await closeWebpageTab(sessionContext(store), 'tab-1');
    expect(closed).toEqual({ closed: true });
    expect(store.getState().tabs.tabs.find((tab: Tab) => tab.tabId === 'tab-1')).toBeUndefined();
  });

  it('captures a screenshot for an open browser tab', async () => {
    const store = createTestStore();
    store.dispatch(
      newBrowserTab({
        tabId: 'tab-1',
        url: 'https://example.com/',
        homeUrl: 'https://example.com/'
      })
    );

    const result = await screenshotWebpage(store.getState() as unknown as RootState, 'tab-1');
    expect(isWebpageSessionError(result)).toBe(false);
    if (!isWebpageSessionError(result)) {
      expect(result.pngBase64).toBe('abc');
      expect(result.dataUrl).toContain('data:image/png');
    }
    expect(window.api.browserCapturePage).toHaveBeenCalledWith('tab-1', { fullPage: false });
  });

  it('forwards fullPage when capturing a full-page screenshot', async () => {
    const store = createTestStore();
    store.dispatch(
      newBrowserTab({
        tabId: 'tab-1',
        url: 'https://example.com/',
        homeUrl: 'https://example.com/'
      })
    );

    const result = await screenshotWebpage(store.getState() as unknown as RootState, 'tab-1', true);
    expect(isWebpageSessionError(result)).toBe(false);
    expect(window.api.browserCapturePage).toHaveBeenCalledWith('tab-1', { fullPage: true });
  });

  it('returns an error when screenshot targets a missing tab', async () => {
    const store = createTestStore();
    const result = await screenshotWebpage(store.getState() as unknown as RootState, 'missing');
    expect(isWebpageSessionError(result)).toBe(true);
    if (isWebpageSessionError(result)) {
      expect(result.error).toContain('No browser tab found');
    }
  });
});
