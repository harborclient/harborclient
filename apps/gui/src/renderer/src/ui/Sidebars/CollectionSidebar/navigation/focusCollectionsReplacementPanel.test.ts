import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearPluginContributions,
  registerSidebarPanelContribution
} from '#/renderer/src/plugins/registry';
import {
  collectionsReplacementSurfaceSelector,
  focusCollectionsReplacementPanel
} from './focusCollectionsReplacementPanel';

describe('focusCollectionsReplacementPanel', () => {
  afterEach(() => {
    clearPluginContributions('com.example.replace');
    vi.unstubAllGlobals();
  });

  it('builds a stable attribute selector for the replacement surface', () => {
    expect(collectionsReplacementSurfaceSelector('com.example.replace', 'collections')).toContain(
      'data-hc-plugin-surface="sidebarPanels"'
    );
    expect(collectionsReplacementSurfaceSelector('com.example.replace', 'collections')).toContain(
      'data-hc-contribution-id='
    );
  });

  it('returns false when no replacement panel is registered', () => {
    expect(focusCollectionsReplacementPanel()).toBe(false);
  });

  it('focuses the replacement webview after revealing frames', () => {
    registerSidebarPanelContribution('com.example.replace', {
      id: 'plugin:com.example.replace:collections',
      title: 'My Collections',
      contributionId: 'collections',
      replaces: 'collections'
    });

    const focus = vi.fn();
    const webview = { focus };
    const container = {
      querySelector: vi.fn(() => webview)
    };
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal('document', {
      querySelector: vi.fn(() => container)
    });

    expect(focusCollectionsReplacementPanel()).toBe(true);
    expect(document.querySelector).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
  });
});
