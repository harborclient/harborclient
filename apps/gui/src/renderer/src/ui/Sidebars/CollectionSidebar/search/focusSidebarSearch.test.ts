import { afterEach, describe, expect, it, vi } from 'vitest';
import { setActiveSidebarPanel, setShowSidebar } from '#/renderer/src/store/slices/navigationSlice';
import {
  clearPluginContributions,
  registerSidebarPanelContribution
} from '#/renderer/src/plugins/registry';
import { focusSidebarSearch } from './focusSidebarSearch';

describe('focusSidebarSearch', () => {
  afterEach(() => {
    clearPluginContributions('com.example.replace');
    vi.unstubAllGlobals();
  });

  it('dispatches navigation actions to reveal the sidebar search field', () => {
    const dispatch = vi.fn();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal('document', {
      getElementById: vi.fn()
    });

    focusSidebarSearch(dispatch);

    expect(dispatch).toHaveBeenCalledWith(setShowSidebar(true));
    expect(dispatch).toHaveBeenCalledWith(setActiveSidebarPanel(null));
  });

  it('reveals the primary surface and focuses the replacement webview when active', () => {
    registerSidebarPanelContribution('com.example.replace', {
      id: 'plugin:com.example.replace:collections',
      title: 'My Collections',
      contributionId: 'collections',
      replaces: 'collections'
    });

    const dispatch = vi.fn();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal('document', {
      querySelector: vi.fn()
    });

    focusSidebarSearch(dispatch);

    expect(dispatch).toHaveBeenCalledWith(setShowSidebar(true));
    expect(dispatch).toHaveBeenCalledWith(setActiveSidebarPanel(null));
    expect(document.querySelector).toHaveBeenCalled();
  });
});
