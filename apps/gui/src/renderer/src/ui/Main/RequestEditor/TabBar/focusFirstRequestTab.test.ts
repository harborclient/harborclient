import { describe, expect, it, vi } from 'vitest';
import { createPageTab, createTab } from '#/renderer/src/store/tabs';
import { setShowRequestEditor } from '#/renderer/src/store/slices/navigationSlice';
import { setActiveTab } from '#/renderer/src/store/slices/tabsSlice';
import {
  focusFirstRequestTab,
  focusRequestTabControl,
  requestTabElementId
} from './focusFirstRequestTab';

describe('focusRequestTabControl', () => {
  it('focuses and scrolls the tab control into view', () => {
    const focus = vi.fn();
    const scrollIntoView = vi.fn();
    const tabElement = { focus, scrollIntoView };

    vi.stubGlobal('document', {
      activeElement: tabElement,
      getElementById: vi.fn(() => tabElement)
    });

    expect(focusRequestTabControl('tab-1')).toBe(true);
    expect(focus).toHaveBeenCalledWith();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });

    vi.unstubAllGlobals();
  });
});

describe('focusFirstRequestTab', () => {
  it('activates and focuses the leftmost request tab', () => {
    const requestTab = createTab();
    const pageTab = createPageTab({ type: 'plugins' });
    const dispatch = vi.fn();
    const getState = vi.fn(() => ({
      tabs: {
        tabs: [pageTab, requestTab],
        activeTabId: pageTab.tabId
      }
    }));
    const focus = vi.fn();
    const tabElement = { focus, scrollIntoView: vi.fn() };

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal('document', {
      activeElement: tabElement,
      getElementById: vi.fn((id: string) =>
        id === requestTabElementId(requestTab.tabId) ? tabElement : null
      )
    });

    focusFirstRequestTab(dispatch, getState as never);

    expect(dispatch).toHaveBeenCalledWith(setShowRequestEditor(true));
    expect(dispatch).toHaveBeenCalledWith(setActiveTab(requestTab.tabId));
    expect(focus).toHaveBeenCalledWith();

    vi.unstubAllGlobals();
  });

  it('no-ops when no request tabs are open', () => {
    const dispatch = vi.fn();
    const pageTab = createPageTab({ type: 'plugins' });
    const getState = vi.fn(() => ({
      tabs: {
        tabs: [pageTab],
        activeTabId: pageTab.tabId
      }
    }));

    focusFirstRequestTab(dispatch, getState as never);

    expect(dispatch).not.toHaveBeenCalled();
  });
});
