import { RESPONSE_EDITOR_SECTION_ID } from '#/renderer/src/ui/Main/ResponseEditor/focusResponseEditor';

/** Stable id of the collections sidebar skip target wrapper in the app shell. */
export const COLLECTIONS_SIDEBAR_SECTION_ID = 'collections-sidebar';

/** Stable id of the request editor root section in the main request editor. */
export const REQUEST_EDITOR_SECTION_ID = 'request-editor';

/** Stable id of the AI sidebar skip target wrapper in the app shell. */
export const AI_SIDEBAR_SECTION_ID = 'ai-sidebar';

/** Stable id of the Git sidebar skip target wrapper in the app shell. */
export const GIT_SIDEBAR_SECTION_ID = 'git-sidebar';

/** Stable id of the persistent footer bar skip target. */
export const APP_FOOTER_SECTION_ID = 'app-footer';

/** Stable id of the skip navigation menu landmark. */
export const SKIP_NAVIGATION_ID = 'skip-navigation';

export { RESPONSE_EDITOR_SECTION_ID };

/**
 * One keyboard skip link pointing at a major UI region.
 */
export interface SkipNavigationLink {
  /**
   * Stable key for React list rendering.
   */
  id: string;

  /**
   * Visible link text announced to screen readers.
   */
  label: string;

  /**
   * DOM id of the focusable landmark to activate.
   */
  targetId: string;
}

/**
 * Panel visibility inputs used to decide which skip links are shown.
 */
export interface SkipNavigationVisibility {
  /**
   * Whether the collections sidebar panel is open.
   */
  sidebarVisible: boolean;

  /**
   * Whether the request editor panel is open.
   */
  requestEditorVisible: boolean;

  /**
   * Whether the response viewer panel is open.
   */
  responseEditorVisible: boolean;

  /**
   * Whether the AI sidebar panel is open.
   */
  aiSidebarVisible: boolean;

  /**
   * Whether the Git sidebar panel is open.
   */
  gitSidebarVisible: boolean;

  /**
   * Whether the active tab is a request workspace rather than a settings/page tab.
   */
  isRequestWorkspace: boolean;
}

/**
 * Builds the skip links that should appear for the current layout state.
 *
 * Hidden panels and non-request workspaces omit their links so keyboard users
 * never land on targets that are absent from the DOM.
 *
 * @param visibility - Current panel and workspace visibility flags.
 * @returns Ordered skip links for the skip navigation menu.
 */
export function resolveSkipNavigationLinks(
  visibility: SkipNavigationVisibility
): SkipNavigationLink[] {
  const links: SkipNavigationLink[] = [];

  if (visibility.sidebarVisible) {
    links.push({
      id: 'collections-sidebar',
      label: 'Skip to Collections sidebar',
      targetId: COLLECTIONS_SIDEBAR_SECTION_ID
    });
  }

  if (visibility.isRequestWorkspace && visibility.requestEditorVisible) {
    links.push({
      id: 'request-editor',
      label: 'Skip to Request editor',
      targetId: REQUEST_EDITOR_SECTION_ID
    });
  }

  if (visibility.isRequestWorkspace && visibility.responseEditorVisible) {
    links.push({
      id: 'response-editor',
      label: 'Skip to Response viewer',
      targetId: RESPONSE_EDITOR_SECTION_ID
    });
  }

  if (visibility.aiSidebarVisible) {
    links.push({
      id: 'ai-sidebar',
      label: 'Skip to AI sidebar',
      targetId: AI_SIDEBAR_SECTION_ID
    });
  }

  if (visibility.gitSidebarVisible) {
    links.push({
      id: 'git-sidebar',
      label: 'Skip to Git sidebar',
      targetId: GIT_SIDEBAR_SECTION_ID
    });
  }

  links.push({
    id: 'app-footer',
    label: 'Skip to Footer',
    targetId: APP_FOOTER_SECTION_ID
  });

  return links;
}
