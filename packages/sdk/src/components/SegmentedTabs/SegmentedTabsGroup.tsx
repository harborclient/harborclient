import { createElement, useId, useMemo } from '@harborclient/sdk/react';
import type { JSX, ReactNode } from 'react';
import { SegmentedTabsContext, type SegmentedTabsContextValue } from './SegmentedTabsContext.js';

interface Props<T extends string> {
  /**
   * Currently selected tab value.
   */
  value: T;

  /**
   * Called when the user selects a different tab.
   */
  onChange: (value: T) => void;

  /**
   * Accessible name for the tab list.
   */
  ariaLabel: string;

  /**
   * Tab list and linked tab panels.
   */
  children: ReactNode;
}

/**
 * Provides tab selection state and stable ids for `SegmentedTabs` and
 * `SegmentedTabPanel` children.
 */
export function SegmentedTabsGroup<T extends string>({
  value,
  onChange,
  ariaLabel,
  children
}: Props<T>): JSX.Element {
  const baseId = useId();

  /**
   * Memoizes context so tab ids stay stable across renders while value updates
   * propagate to list and panel children.
   */
  const contextValue = useMemo(
    (): SegmentedTabsContextValue => ({
      value,
      onChange: (nextValue) => onChange(nextValue as T),
      ariaLabel,
      getTabId: (tabValue) => `${baseId}-tab-${tabValue}`,
      getPanelId: (tabValue) => `${baseId}-panel-${tabValue}`
    }),
    [value, onChange, ariaLabel, baseId]
  );

  return createElement(SegmentedTabsContext.Provider, { value: contextValue }, children);
}
