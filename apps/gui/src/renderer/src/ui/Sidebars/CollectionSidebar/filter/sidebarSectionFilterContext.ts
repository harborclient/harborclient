import { createContext, useContext, type Dispatch, type SetStateAction } from 'react';
import type { CollectionsFilterCriteria } from '../Collections/collectionsFilter';

/**
 * Section filter state shared between Collections/Runs/History/Tab Groups/
 * Environments/Archive headers and lists.
 */
export interface SidebarSectionFilterContextValue {
  /**
   * Applied Collections section filter criteria, or all-null when inactive.
   */
  collectionsFilter: CollectionsFilterCriteria;

  /**
   * Updates the Collections section filter criteria.
   */
  setCollectionsFilter: Dispatch<SetStateAction<CollectionsFilterCriteria>>;

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

  /**
   * CSS marker to filter Tab Groups by, or null when showing all tab groups.
   */
  tabGroupsMarkerFilter: string | null;

  /**
   * Updates the Tab Groups marker filter.
   */
  setTabGroupsMarkerFilter: Dispatch<SetStateAction<string | null>>;

  /**
   * CSS marker to filter Environments by, or null when showing all environments.
   */
  environmentsMarkerFilter: string | null;

  /**
   * Updates the Environments marker filter.
   */
  setEnvironmentsMarkerFilter: Dispatch<SetStateAction<string | null>>;

  /**
   * CSS marker to filter Archive by, or null when showing all archived collections.
   */
  archiveMarkerFilter: string | null;

  /**
   * Updates the Archive marker filter.
   */
  setArchiveMarkerFilter: Dispatch<SetStateAction<string | null>>;

  /**
   * Clears every section filter so lists show unfiltered content.
   */
  clearAllSectionFilters: () => void;
}

/**
 * React context for Collections/Runs/History/Tab Groups/Environments/Archive section filters.
 */
export const SidebarSectionFilterContext = createContext<SidebarSectionFilterContextValue | null>(
  null
);

/**
 * Returns shared sidebar section filter state.
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
