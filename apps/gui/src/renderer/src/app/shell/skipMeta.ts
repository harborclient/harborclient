import type { ShellPanelId } from './types';

/**
 * Visibility flag name on skip-nav visibility used to show a shell panel skip link.
 */
export type ShellPanelVisibilityKey =
  | 'sidebarVisible'
  | 'aiSidebarVisible'
  | 'gitSidebarVisible'
  | 'shortcutsSidebarVisible'
  | 'liveServerLogsSidebarVisible';

/**
 * Pure skip-nav metadata for a shell sidebar panel (no React / catalog imports).
 */
export interface ShellPanelSkipMeta {
  /**
   * Skip link id, label, and DOM target (panel section id).
   */
  link: {
    id: string;
    label: string;
    targetId: string;
  };

  /**
   * Which visibility flag gates this link.
   */
  visibilityKey: ShellPanelVisibilityKey;
}

/**
 * Skip-nav metadata for shell panels that appear in primary/secondary sidebar zones.
 *
 * Main-column and request/response landmarks are handled separately in
 * `resolveSkipNavigationLinks` because they depend on tab type and nested editor state.
 */
export const shellPanelSkipMeta: Partial<Record<ShellPanelId, ShellPanelSkipMeta>> = {
  'collections-sidebar': {
    link: {
      id: 'collections-sidebar',
      label: 'Skip to Collections sidebar',
      targetId: 'collections-sidebar'
    },
    visibilityKey: 'sidebarVisible'
  },
  'git-sidebar': {
    link: {
      id: 'git-sidebar',
      label: 'Skip to Git sidebar',
      targetId: 'git-sidebar'
    },
    visibilityKey: 'gitSidebarVisible'
  },
  'ai-sidebar': {
    link: {
      id: 'ai-sidebar',
      label: 'Skip to AI sidebar',
      targetId: 'ai-sidebar'
    },
    visibilityKey: 'aiSidebarVisible'
  },
  'shortcuts-sidebar': {
    link: {
      id: 'shortcuts-sidebar',
      label: 'Skip to Shortcuts sidebar',
      targetId: 'shortcuts-sidebar'
    },
    visibilityKey: 'shortcutsSidebarVisible'
  },
  'live-server-logs-sidebar': {
    link: {
      id: 'live-server-logs-sidebar',
      label: 'Skip to Live server logs',
      targetId: 'live-server-logs-sidebar'
    },
    visibilityKey: 'liveServerLogsSidebarVisible'
  }
};
