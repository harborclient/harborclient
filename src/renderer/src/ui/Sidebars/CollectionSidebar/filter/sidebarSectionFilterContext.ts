import { createContext, useContext, type Dispatch, type SetStateAction } from 'react';

/**
 * Collection filter state shared between Runs/History section headers and lists.
 */
export interface SidebarSectionFilterContextValue {
  /**
   * Collection display name to filter Runs by, or null when showing all runs.
   */
  runsCollectionFilter: string | null;

  /**
   * Updates the Runs collection name filter.
   */
  setRunsCollectionFilter: Dispatch<SetStateAction<string | null>>;

  /**
   * Collection id to filter History by, or null when showing all history entries.
   */
  historyCollectionFilter: number | null;

  /**
   * Updates the History collection id filter.
   */
  setHistoryCollectionFilter: Dispatch<SetStateAction<number | null>>;
}

/**
 * React context for Runs/History section collection filters.
 */
export const SidebarSectionFilterContext = createContext<SidebarSectionFilterContextValue | null>(
  null
);

/**
 * Returns shared Runs/History collection filter state.
 *
 * @throws When called outside `SidebarSectionFilterProvider`.
 */
export function useSidebarSectionFilter(): SidebarSectionFilterContextValue {
  const context = useContext(SidebarSectionFilterContext);
  if (!context) {
    throw new Error('useSidebarSectionFilter must be used within SidebarSectionFilterProvider');
  }
  return context;
}
