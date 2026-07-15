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
} from '#/renderer/src/ui/shared/SkipNavigation/skipNavigationTargets';

/**
 * Builds a visibility fixture with every panel open on a request workspace.
 */
function allVisibleRequestWorkspace(
  overrides: Partial<SkipNavigationVisibility> = {}
): SkipNavigationVisibility {
  return {
    sidebarVisible: true,
    requestEditorVisible: true,
    responseEditorVisible: true,
    aiSidebarVisible: true,
    gitSidebarVisible: true,
    isRequestWorkspace: true,
    ...overrides
  };
}

describe('resolveSkipNavigationLinks', () => {
  it('returns all major region links when every panel is visible on a request tab', () => {
    expect(resolveSkipNavigationLinks(allVisibleRequestWorkspace())).toEqual([
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
      allVisibleRequestWorkspace({
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

  it('omits request and response links outside a request workspace', () => {
    const links = resolveSkipNavigationLinks(
      allVisibleRequestWorkspace({
        isRequestWorkspace: false
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
      allVisibleRequestWorkspace({
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
      allVisibleRequestWorkspace({
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

    const visiblePanels = resolveSkipNavigationLinks(allVisibleRequestWorkspace());
    expect(visiblePanels.some((link) => link.id === 'app-footer')).toBe(true);
  });
});
