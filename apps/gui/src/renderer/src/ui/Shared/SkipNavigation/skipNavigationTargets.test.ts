import { describe, expect, it } from 'vitest';
import {
  AI_SIDEBAR_SECTION_ID,
  APP_FOOTER_SECTION_ID,
  COLLECTIONS_SIDEBAR_SECTION_ID,
  GIT_SIDEBAR_SECTION_ID,
  REQUEST_EDITOR_SECTION_ID,
  RESPONSE_EDITOR_SECTION_ID,
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
    isRequestTab: true,
    ...overrides
  };
}

describe('resolveSkipNavigationLinks', () => {
  it('returns all major region links when every panel is visible on a request tab', () => {
    expect(resolveSkipNavigationLinks(allVisibleRequestTab())).toEqual([
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
        id: 'ai-sidebar',
        label: 'Skip to AI sidebar',
        targetId: AI_SIDEBAR_SECTION_ID
      },
      {
        id: 'git-sidebar',
        label: 'Skip to Git sidebar',
        targetId: GIT_SIDEBAR_SECTION_ID
      },
      {
        id: 'app-footer',
        label: 'Skip to Footer',
        targetId: APP_FOOTER_SECTION_ID
      }
    ]);
  });

  it('omits hidden sidebars from the skip menu', () => {
    const links = resolveSkipNavigationLinks(
      allVisibleRequestTab({
        sidebarVisible: false,
        aiSidebarVisible: false,
        gitSidebarVisible: false
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
      'ai-sidebar',
      'git-sidebar',
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
      'ai-sidebar',
      'git-sidebar',
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
        gitSidebarVisible: false
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
