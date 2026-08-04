import type { ReactNode } from 'react';
import type { SidebarPlacement } from '@harborclient/core/types';
import type { RootState } from '#/renderer/src/store/redux';

/** Shell catalog id for the main content column (request editor + footer panels). */
export const MAIN_COLUMN_PANEL_ID = 'main-column';

export type { SidebarPlacement };

/**
 * Stable ids for panels that can be placed in an {@link ShellLayoutConfig} zone.
 *
 * Sidebar values match the skip-target / animated-wrapper DOM ids in
 * `skipNavigationTargets.ts`.
 */
export type ShellPanelId =
  | 'collections-sidebar'
  | 'git-sidebar'
  | 'ai-sidebar'
  | 'shortcuts-sidebar'
  | 'live-server-logs-sidebar'
  | typeof MAIN_COLUMN_PANEL_ID;

/**
 * Named horizontal zones of the app shell middle band (left → right in DOM).
 */
export type ShellZone = 'primarySidebar' | 'main' | 'secondarySidebar';

/**
 * How a catalog panel is mounted in the shell.
 */
export type ShellPanelKind = 'animatedHorizontal' | 'main';

/**
 * Skip-link metadata for a shell panel that participates in skip navigation.
 */
export interface ShellPanelSkipLink {
  /**
   * Stable key for React list rendering.
   */
  id: string;

  /**
   * Visible link text announced to screen readers.
   */
  label: string;
}

/**
 * Catalog entry describing how to mount a shell panel and when it is open.
 */
export interface ShellPanelDescriptor {
  /**
   * Stable panel id used in layout zone arrays and as the animated wrapper DOM id.
   */
  id: ShellPanelId;

  /**
   * Mount strategy for this panel.
   */
  kind: ShellPanelKind;

  /**
   * Returns whether the panel should be expanded / visible.
   *
   * @param state - Root Redux state.
   * @returns True when the panel is open.
   */
  selectOpen: (state: RootState) => boolean;

  /**
   * Optional skip-link label metadata. Target id is the panel id.
   */
  skipLink?: ShellPanelSkipLink;

  /**
   * When false, children are not mounted while the panel is closed (live-server logs).
   * Defaults to true (keep children mounted for open/close animation).
   */
  mountWhenClosed?: boolean;

  /**
   * Renders the panel body.
   *
   * @returns Panel content for the shell wrapper.
   */
  render: () => ReactNode;
}

/**
 * Declarative placement of panel ids into shell zones.
 */
export type ShellLayoutConfig = Record<ShellZone, ShellPanelId[]>;
