import { describe, expect, it } from 'vitest';
import { defaultShellLayout } from '#/renderer/src/app/shell/defaultLayout';
import { withSidebarPlacement } from '#/renderer/src/app/shell/withSidebarPlacement';
import {
  AI_SIDEBAR_SECTION_ID,
  APP_FOOTER_SECTION_ID,
  COLLECTIONS_SIDEBAR_SECTION_ID,
  GIT_SIDEBAR_SECTION_ID,
  LIVE_SERVER_LOGS_SIDEBAR_SECTION_ID,
  REQUEST_EDITOR_SECTION_ID,
  RESPONSE_EDITOR_SECTION_ID,
  SHORTCUTS_SIDEBAR_SECTION_ID,
  resolveSkipNavigationLinks,
  type SkipNavigationVisibility
} from './skipNavigationTargets';

/**
 * Builds a visibility fixture with every panel open on a request tab.
 */
function allVisibleRequestTab(
  overrides: Partial<SkipNavigationVisibility> = {}
): SkipNavigationVisibility {
  return {
    sidebarVisible: true,
    requestEditorVisible: true,
    responseEditorVisible: true,
    aiSidebarVisible: true,
    gitSidebarVisible: true,
    shortcutsSidebarVisible: true,
    liveServerLogsSidebarVisible: true,
    isRequestTab: true,
    ...overrides
  };
}

describe('resolveSkipNavigationLinks', () => {
  it('returns all major region links in default shell layout order', () => {
    expect(resolveSkipNavigationLinks(allVisibleRequestTab(), defaultShellLayout)).toEqual([
      {
        id: 'collections-sidebar',
        label: 'Skip to Collections sidebar',
        targetId: COLLECTIONS_SIDEBAR_SECTION_ID
      },
      {
        id: 'request-editor',
        label: 'Skip to Request editor',
        targetId: REQUEST_EDITOR_SECTION_ID
      },
      {
        id: 'response-editor',
        label: 'Skip to Response viewer',
        targetId: RESPONSE_EDITOR_SECTION_ID
      },
      {
        id: 'git-sidebar',
        label: 'Skip to Git sidebar',
        targetId: GIT_SIDEBAR_SECTION_ID
      },
      {
        id: 'ai-sidebar',
        label: 'Skip to AI sidebar',
        targetId: AI_SIDEBAR_SECTION_ID
      },
      {
        id: 'shortcuts-sidebar',
        label: 'Skip to Shortcuts sidebar',
        targetId: SHORTCUTS_SIDEBAR_SECTION_ID
      },
      {
        id: 'live-server-logs-sidebar',
        label: 'Skip to Live server logs',
        targetId: LIVE_SERVER_LOGS_SIDEBAR_SECTION_ID
      },
      {
        id: 'app-footer',
        label: 'Skip to Footer',
        targetId: APP_FOOTER_SECTION_ID
      }
    ]);
  });

  it('orders skip links by right sidebar placement when zones are swapped', () => {
    const layout = withSidebarPlacement(defaultShellLayout, 'right');
    const links = resolveSkipNavigationLinks(allVisibleRequestTab(), layout);

    expect(links.map((link) => link.id)).toEqual([
      'git-sidebar',
      'ai-sidebar',
      'shortcuts-sidebar',
      'live-server-logs-sidebar',
      'request-editor',
      'response-editor',
      'collections-sidebar',
      'app-footer'
    ]);
  });

  it('omits hidden sidebars from the skip menu', () => {
    const links = resolveSkipNavigationLinks(
      allVisibleRequestTab({
        sidebarVisible: false,
        aiSidebarVisible: false,
        gitSidebarVisible: false,
        shortcutsSidebarVisible: false,
        liveServerLogsSidebarVisible: false
      })
    );

    expect(links.map((link) => link.id)).toEqual([
      'request-editor',
      'response-editor',
      'app-footer'
    ]);
  });

  it('omits request and response links outside a request tab', () => {
    const links = resolveSkipNavigationLinks(
      allVisibleRequestTab({
        isRequestTab: false
      })
    );

    expect(links.map((link) => link.id)).toEqual([
      'collections-sidebar',
      'git-sidebar',
      'ai-sidebar',
      'shortcuts-sidebar',
      'live-server-logs-sidebar',
      'app-footer'
    ]);
  });

  it('omits request and response links when those panels are hidden', () => {
    const links = resolveSkipNavigationLinks(
      allVisibleRequestTab({
        requestEditorVisible: false,
        responseEditorVisible: false
      })
    );

    expect(links.map((link) => link.id)).toEqual([
      'collections-sidebar',
      'git-sidebar',
      'ai-sidebar',
      'shortcuts-sidebar',
      'live-server-logs-sidebar',
      'app-footer'
    ]);
  });

  it('always includes the footer link', () => {
    const hiddenPanels = resolveSkipNavigationLinks(
      allVisibleRequestTab({
        sidebarVisible: false,
        requestEditorVisible: false,
        responseEditorVisible: false,
        aiSidebarVisible: false,
        gitSidebarVisible: false,
        shortcutsSidebarVisible: false,
        liveServerLogsSidebarVisible: false
      })
    );

    expect(hiddenPanels).toEqual([
      {
        id: 'app-footer',
        label: 'Skip to Footer',
        targetId: APP_FOOTER_SECTION_ID
      }
    ]);

    const visiblePanels = resolveSkipNavigationLinks(allVisibleRequestTab());
    expect(visiblePanels.some((link) => link.id === 'app-footer')).toBe(true);
  });
});
