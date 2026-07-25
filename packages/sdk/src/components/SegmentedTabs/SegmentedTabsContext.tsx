import { createContext } from '@harborclient/sdk/react';

export interface SegmentedTabsContextValue {
  /**
   * Currently selected tab value.
   */
  value: string;

  /**
   * Selects a tab by value.
   */
  onChange: (value: string) => void;

  /**
   * Accessible name for the tab list.
   */
  ariaLabel: string;

  /**
   * Stable DOM id for a tab control.
   */
  getTabId: (value: string) => string;

  /**
   * Stable DOM id for a tab panel linked to a tab.
   */
  getPanelId: (value: string) => string;
}

export const SegmentedTabsContext = createContext<SegmentedTabsContextValue | null>(null);
