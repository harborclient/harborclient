import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it, vi } from 'vitest';
import { defaultAuth } from '@harborclient/core/auth';
import type { Website } from '@harborclient/core/types';
import type { AppDispatch } from '#/renderer/src/store/redux';
import tabsReducer, { type TabsState } from '#/renderer/src/store/slices/tabsSlice';
import websitesReducer, { setWebsites } from '#/renderer/src/store/slices/websitesSlice';
import { isBrowserTab, isPageTab } from '#/renderer/src/store/tabs';
import { openWebsiteSettings, websiteNameFromTab } from './websites';

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
 * @returns Website with deterministic ids and empty scripts.
 */
function sampleWebsite(): Website {
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
    updatedAt: 1
  };
}

/**
 * Store with websites + tabs slices for openWebsiteSettings coverage.
 *
 * @returns Typed dispatch and tab-state accessor.
 */
function createTestStore(): {
  dispatch: AppDispatch;
  getTabs: () => TabsState;
} {
  const store = configureStore({
    reducer: {
      websites: websitesReducer,
      tabs: tabsReducer
    }
  });
  return {
    dispatch: store.dispatch as AppDispatch,
    getTabs: (): TabsState => (store.getState() as { tabs: TabsState }).tabs
  };
}

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

describe('openWebsiteSettings', () => {
  it('opens the website browser tab and its browser-settings page', async () => {
    const { dispatch, getTabs } = createTestStore();
    dispatch(setWebsites([sampleWebsite()]));

    await dispatch(openWebsiteSettings(7));

    const { tabs, activeTabId } = getTabs();
    const browserTab = tabs.find((tab) => isBrowserTab(tab) && tab.websiteId === 7);
    expect(browserTab).toBeDefined();
    if (!browserTab || !isBrowserTab(browserTab)) {
      throw new Error('expected browser tab');
    }

    const settingsTab = tabs.find(
      (tab) =>
        isPageTab(tab) &&
        tab.page.type === 'browser-settings' &&
        tab.page.browserTabId === browserTab.tabId
    );
    expect(settingsTab).toBeDefined();
    expect(activeTabId).toBe(settingsTab?.tabId);
    expect(
      settingsTab &&
        isPageTab(settingsTab) &&
        settingsTab.page.type === 'browser-settings' &&
        settingsTab.page.label
    ).toBe('Live Page Settings');
  });
});
