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
   * CSS color to filter Tab Groups by, or null when showing all tab groups.
   */
  tabGroupsColorFilter: string | null;

  /**
   * Updates the Tab Groups color filter.
   */
  setTabGroupsColorFilter: Dispatch<SetStateAction<string | null>>;

  /**
   * CSS color to filter Environments by, or null when showing all environments.
   */
  environmentsColorFilter: string | null;

  /**
   * Updates the Environments color filter.
   */
  setEnvironmentsColorFilter: Dispatch<SetStateAction<string | null>>;

  /**
   * CSS color to filter Archive by, or null when showing all archived collections.
   */
  archiveColorFilter: string | null;

  /**
   * Updates the Archive color filter.
   */
  setArchiveColorFilter: Dispatch<SetStateAction<string | null>>;

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
