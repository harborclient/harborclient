import { beforeEach, describe, expect, it } from 'vitest';
import { store } from '#/renderer/src/store/redux';
import { closeTab } from '#/renderer/src/store/slices/tabsSlice';
import { isPageTab } from '#/renderer/src/store/tabs';
import { openImageView } from './hostImageCommands';

/**
 * Closes every open tab so host command tests start from a clean slate.
 */
function closeEveryTab(): void {
  for (const tab of [...store.getState().tabs.tabs]) {
    store.dispatch(closeTab(tab.tabId));
  }
}

describe('openImageView', () => {
  beforeEach(() => {
    closeEveryTab();
  });

  it('opens a page tab for a path payload', () => {
    openImageView({ path: '/tmp/shot.png' });

    const tabs = store.getState().tabs.tabs;
    expect(tabs).toHaveLength(1);
    const tab = tabs[0];
    expect(tab && isPageTab(tab)).toBe(true);
    if (!tab || !isPageTab(tab)) {
      return;
    }
    expect(tab.page).toEqual({
      type: 'image-view',
      fileName: 'shot.png',
      shortLabel: 'shot.png',
      source: { kind: 'path', path: '/tmp/shot.png' }
    });
  });

  it('opens a page tab for a url payload', () => {
    openImageView({ url: 'https://example.com/logo.png' });

    const tab = store.getState().tabs.tabs[0];
    expect(tab && isPageTab(tab) && tab.page.type === 'image-view').toBe(true);
    if (!tab || !isPageTab(tab) || tab.page.type !== 'image-view') {
      return;
    }
    expect(tab.page.source).toEqual({ kind: 'url', url: 'https://example.com/logo.png' });
  });

  it('opens a page tab for a base64 payload', () => {
    openImageView({
      fileName: 'chart.png',
      base64: 'abc',
      contentType: 'image/png'
    });

    const tab = store.getState().tabs.tabs[0];
    expect(tab && isPageTab(tab) && tab.page.type === 'image-view').toBe(true);
    if (!tab || !isPageTab(tab) || tab.page.type !== 'image-view') {
      return;
    }
    expect(tab.page.source).toEqual({ kind: 'data', dataUrl: 'data:image/png;base64,abc' });
  });

  it('focuses an existing tab instead of opening a duplicate', () => {
    openImageView({ path: '/tmp/shot.png' });
    const firstTabId = store.getState().tabs.activeTabId;
    openImageView({ path: '/tmp/other.png' });
    openImageView({ path: '/tmp/shot.png' });

    expect(store.getState().tabs.tabs).toHaveLength(2);
    expect(store.getState().tabs.activeTabId).toBe(firstTabId);
  });

  it('rejects invalid payloads', () => {
    expect(() => openImageView({} as never)).toThrow(/exactly one/i);
  });
});
