import { MAIN_COLUMN_PANEL_ID, type ShellLayoutConfig } from './types';

/**
 * Default shell layout: collections on the left, editor in the center, other
 * sidebars stacked on the right (matching the pre-AppShell DOM order).
 */
export const defaultShellLayout: ShellLayoutConfig = {
  primarySidebar: ['collections-sidebar'],
  main: [MAIN_COLUMN_PANEL_ID],
  secondarySidebar: ['git-sidebar', 'ai-sidebar', 'shortcuts-sidebar', 'live-server-logs-sidebar']
};
