import type { ReactNode } from 'react';

/**
 * Data for a single tab row rendered by {@link TabBar}.
 */
export interface TabBarItem<TId extends string | number> {
  /**
   * Stable tab identifier used for selection, close, and reorder callbacks.
   */
  id: TId;

  /**
   * Whether this tab is the currently selected tab.
   */
  active: boolean;

  /**
   * Label and icon content rendered inside the tab shell.
   */
  content: ReactNode;

  /**
   * Accessible name for the tab control, including unsaved or status suffixes.
   */
  accessibleName: string;

  /**
   * Accessible name for the close button, typically including the tab title.
   */
  closeAccessibleName: string;

  /**
   * Native tooltip text when the label is truncated.
   */
  title?: string;

  /**
   * Plain-text or element preview shown in the drag overlay.
   */
  dragLabel: ReactNode;

  /**
   * When true, uses active styling even when not selected (for example tab group edit).
   */
  highlighted?: boolean;
}

/**
 * Configuration for the new-tab "+" control at the end of the tab bar.
 */
export interface TabBarNewTab {
  /**
   * Accessible name for the new-tab control.
   */
  ariaLabel: string;

  /**
   * Native tooltip text for the new-tab control.
   */
  title: string;

  /**
   * Called when the user opens a new tab or chat.
   */
  onClick: () => void;
}

/**
 * Cursor style applied to draggable tab rows when reordering is enabled.
 */
export type TabBarSortableCursor = 'pointer' | 'grab';
