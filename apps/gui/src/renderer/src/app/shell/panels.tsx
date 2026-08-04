import type { ReactNode } from 'react';
import {
  selectAiSidebarVisible,
  selectGitSidebarVisible,
  selectLiveServerLogsSidebarOpen,
  selectShortcutsSidebarVisible,
  selectSidebarVisible
} from '#/renderer/src/store/slices/navigationSlice';
import { FooterPanels } from '#/renderer/src/ui/Footer/FooterPanels';
import { RequestEditor } from '#/renderer/src/ui/Main/RequestEditor';
import { AiSidebar } from '#/renderer/src/ui/Sidebars/AiSidebar';
import { CollectionSidebar } from '#/renderer/src/ui/Sidebars/CollectionSidebar';
import { GitSidebar } from '#/renderer/src/ui/Sidebars/GitSidebar';
import { LiveServerLogsSidebar } from '#/renderer/src/ui/Sidebars/LiveServerLogsSidebar';
import { ShortcutsSidebar } from '#/renderer/src/ui/Sidebars/ShortcutsSidebar';
import {
  AI_SIDEBAR_SECTION_ID,
  COLLECTIONS_SIDEBAR_SECTION_ID,
  GIT_SIDEBAR_SECTION_ID,
  LIVE_SERVER_LOGS_SIDEBAR_SECTION_ID,
  SHORTCUTS_SIDEBAR_SECTION_ID
} from '#/renderer/src/ui/Shared/SkipNavigation/skipNavigationTargets';
import { MAIN_COLUMN_PANEL_ID, type ShellPanelDescriptor, type ShellPanelId } from './types';

/**
 * Renders the collections sidebar body for the shell catalog.
 *
 * @returns Collections sidebar tree and activity rail.
 */
function renderCollectionsSidebar(): ReactNode {
  return <CollectionSidebar />;
}

/**
 * Renders the Git sidebar body for the shell catalog.
 *
 * @returns Git source-control sidebar.
 */
function renderGitSidebar(): ReactNode {
  return <GitSidebar />;
}

/**
 * Renders the AI sidebar body for the shell catalog.
 *
 * @returns AI assistant sidebar.
 */
function renderAiSidebar(): ReactNode {
  return <AiSidebar />;
}

/**
 * Renders the Shortcuts sidebar body for the shell catalog.
 *
 * @returns Keyboard shortcuts reference sidebar.
 */
function renderShortcutsSidebar(): ReactNode {
  return <ShortcutsSidebar />;
}

/**
 * Renders the live-server logs sidebar body for the shell catalog.
 *
 * @returns Streaming live-server logs sidebar.
 */
function renderLiveServerLogsSidebar(): ReactNode {
  return <LiveServerLogsSidebar />;
}

/**
 * Renders the main column: request editor and slide-up footer panels.
 *
 * @returns Main content column children.
 */
function renderMainColumn(): ReactNode {
  return (
    <>
      <RequestEditor />
      <FooterPanels />
    </>
  );
}

/**
 * Catalog of shell panels keyed by id. Layout configs reference these ids;
 * {@link AppShell} mounts them into zones.
 */
export const shellPanels: Record<ShellPanelId, ShellPanelDescriptor> = {
  [COLLECTIONS_SIDEBAR_SECTION_ID]: {
    id: COLLECTIONS_SIDEBAR_SECTION_ID,
    kind: 'animatedHorizontal',
    selectOpen: selectSidebarVisible,
    skipLink: {
      id: 'collections-sidebar',
      label: 'Skip to Collections sidebar'
    },
    render: renderCollectionsSidebar
  },
  [GIT_SIDEBAR_SECTION_ID]: {
    id: GIT_SIDEBAR_SECTION_ID,
    kind: 'animatedHorizontal',
    selectOpen: selectGitSidebarVisible,
    skipLink: {
      id: 'git-sidebar',
      label: 'Skip to Git sidebar'
    },
    render: renderGitSidebar
  },
  [AI_SIDEBAR_SECTION_ID]: {
    id: AI_SIDEBAR_SECTION_ID,
    kind: 'animatedHorizontal',
    selectOpen: selectAiSidebarVisible,
    skipLink: {
      id: 'ai-sidebar',
      label: 'Skip to AI sidebar'
    },
    render: renderAiSidebar
  },
  [SHORTCUTS_SIDEBAR_SECTION_ID]: {
    id: SHORTCUTS_SIDEBAR_SECTION_ID,
    kind: 'animatedHorizontal',
    selectOpen: selectShortcutsSidebarVisible,
    skipLink: {
      id: 'shortcuts-sidebar',
      label: 'Skip to Shortcuts sidebar'
    },
    render: renderShortcutsSidebar
  },
  [LIVE_SERVER_LOGS_SIDEBAR_SECTION_ID]: {
    id: LIVE_SERVER_LOGS_SIDEBAR_SECTION_ID,
    kind: 'animatedHorizontal',
    selectOpen: selectLiveServerLogsSidebarOpen,
    skipLink: {
      id: 'live-server-logs-sidebar',
      label: 'Skip to Live server logs'
    },
    mountWhenClosed: false,
    render: renderLiveServerLogsSidebar
  },
  [MAIN_COLUMN_PANEL_ID]: {
    id: MAIN_COLUMN_PANEL_ID,
    kind: 'main',
    selectOpen: () => true,
    render: renderMainColumn
  }
};
