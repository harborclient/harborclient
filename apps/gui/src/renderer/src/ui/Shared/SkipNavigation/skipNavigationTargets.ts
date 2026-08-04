import { RESPONSE_EDITOR_SECTION_ID } from '#/renderer/src/ui/Main/ResponseEditor/focusResponseEditor';
import { defaultShellLayout } from '#/renderer/src/app/shell/defaultLayout';
import { shellPanelSkipMeta } from '#/renderer/src/app/shell/skipMeta';
import type { ShellLayoutConfig, ShellPanelId } from '#/renderer/src/app/shell/types';

/** Stable id of the collections sidebar skip target wrapper in the app shell. */
export const COLLECTIONS_SIDEBAR_SECTION_ID = 'collections-sidebar';

/** Stable id of the activity rail skip target inside the collections sidebar. */
export const SIDEBAR_RAIL_SECTION_ID = 'sidebar-rail';

/** Stable id of the request editor root section in the main request editor. */
export const REQUEST_EDITOR_SECTION_ID = 'request-editor';

/** Stable id of the AI sidebar skip target wrapper in the app shell. */
export const AI_SIDEBAR_SECTION_ID = 'ai-sidebar';

/** Stable id of the Git sidebar skip target wrapper in the app shell. */
export const GIT_SIDEBAR_SECTION_ID = 'git-sidebar';

/** Stable id of the Shortcuts sidebar skip target wrapper in the app shell. */
export const SHORTCUTS_SIDEBAR_SECTION_ID = 'shortcuts-sidebar';

/** Stable id of the live-server logs sidebar skip target wrapper in the app shell. */
export const LIVE_SERVER_LOGS_SIDEBAR_SECTION_ID = 'live-server-logs-sidebar';

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
   * Whether the activity rail is shown beside the collections sidebar.
   */
  railVisible: boolean;

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
   * Whether the Shortcuts sidebar panel is open.
   */
  shortcutsSidebarVisible: boolean;

  /**
   * Whether the live-server logs right sidebar is open.
   */
  liveServerLogsSidebarVisible: boolean;

  /**
   * Whether the active tab is a request tab rather than a settings/page tab.
   */
  isRequestTab: boolean;
}

/**
 * Appends skip links for shell sidebar panels in the given zone order when visible.
 *
 * @param links - Mutable list to push into.
 * @param panelIds - Ordered panel ids from a shell layout zone.
 * @param visibility - Current panel visibility flags.
 */
function appendShellZoneSkipLinks(
  links: SkipNavigationLink[],
  panelIds: ShellPanelId[],
  visibility: SkipNavigationVisibility
): void {
  for (const panelId of panelIds) {
    const meta = shellPanelSkipMeta[panelId];
    if (meta == null) {
      continue;
    }

    if (!visibility[meta.visibilityKey]) {
      continue;
    }

    if (panelId === 'collections-sidebar' && visibility.railVisible) {
      links.push({
        id: 'sidebar-rail',
        label: 'Skip to rail',
        targetId: SIDEBAR_RAIL_SECTION_ID
      });
    }

    links.push(meta.link);
  }
}

/**
 * Builds the skip links that should appear for the current layout state.
 *
 * Order follows the shell layout (primary sidebars → request/response → secondary
 * sidebars → footer) so keyboard users match visual left-to-right placement.
 * When the activity rail is visible, its link is inserted immediately before
 * the collections sidebar link. Hidden panels and non-request tabs omit their
 * links so users never land on targets absent from the DOM.
 *
 * @param visibility - Current panel and request-tab visibility flags.
 * @param layout - Shell zone placement; defaults to {@link defaultShellLayout}.
 * @returns Ordered skip links for the skip navigation menu.
 */
export function resolveSkipNavigationLinks(
  visibility: SkipNavigationVisibility,
  layout: ShellLayoutConfig = defaultShellLayout
): SkipNavigationLink[] {
  const links: SkipNavigationLink[] = [];

  appendShellZoneSkipLinks(links, layout.primarySidebar, visibility);

  if (visibility.isRequestTab && visibility.requestEditorVisible) {
    links.push({
      id: 'request-editor',
      label: 'Skip to Request editor',
      targetId: REQUEST_EDITOR_SECTION_ID
    });
  }

  if (visibility.isRequestTab && visibility.responseEditorVisible) {
    links.push({
      id: 'response-editor',
      label: 'Skip to Response viewer',
      targetId: RESPONSE_EDITOR_SECTION_ID
    });
  }

  appendShellZoneSkipLinks(links, layout.secondarySidebar, visibility);

  links.push({
    id: 'app-footer',
    label: 'Skip to Footer',
    targetId: APP_FOOTER_SECTION_ID
  });

  return links;
}
