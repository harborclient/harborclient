import { useMemo, useState, type JSX, type ReactNode } from 'react';
import {
  SidebarSectionFilterContext,
  type SidebarSectionFilterContextValue
} from './sidebarSectionFilterContext';

interface Props {
  /**
   * Sidebar subtree that reads or updates section collection filters.
   */
  children: ReactNode;
}

/**
 * Owns session-only collection filters for the Runs and History sidebar sections
 * so their headers and lists can share the same selection without prop drilling.
 */
export function SidebarSectionFilterProvider({ children }: Props): JSX.Element {
  const [runsCollectionFilter, setRunsCollectionFilter] = useState<string | null>(null);
  const [historyCollectionFilter, setHistoryCollectionFilter] = useState<number | null>(null);

  /**
   * Memoizes the context value so consumers only re-render when a filter changes.
   */
  const value = useMemo<SidebarSectionFilterContextValue>(
    () => ({
      runsCollectionFilter,
      setRunsCollectionFilter,
      historyCollectionFilter,
      setHistoryCollectionFilter
    }),
    [runsCollectionFilter, historyCollectionFilter]
  );

  return (
    <SidebarSectionFilterContext.Provider value={value}>
      {children}
    </SidebarSectionFilterContext.Provider>
  );
}
