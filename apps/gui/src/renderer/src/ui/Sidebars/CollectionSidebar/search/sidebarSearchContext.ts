import { createContext, useContext, type Dispatch, type SetStateAction } from 'react';
import type { SidebarSearchFilter } from '@harborclient/core/search/sidebar';
import type { SidebarMode } from '@harborclient/core/types';

/**
 * Sidebar search state shared across the search field, toolbar, and sections.
 */
export interface SidebarSearchContextValue {
  /**
   * Raw search text from the sidebar search field.
   */
  searchQuery: string;

  /**
   * Updates the sidebar search query.
   */
  setSearchQuery: Dispatch<SetStateAction<string>>;

  /**
   * Visibility sets for filtering sidebar rows, or null when search is inactive.
   */
  searchFilter: SidebarSearchFilter | null;

  /**
   * Archived half of the search filter, or null when search is inactive.
   * Used by the Archive section to show matching archived collections.
   */
  archivedSearchFilter: SidebarSearchFilter | null;

  /**
   * Active (non-archived) half of the search filter, or null when search is inactive.
   */
  activeSearchFilter: SidebarSearchFilter | null;

  /**
   * Convenience flag: true when a search filter is active.
   */
  searchActive: boolean;

  /**
   * True while a non-empty query is active and some collection contents load.
   */
  searchLoading: boolean;

  /**
   * Collapses trees for the active rail mode and clears active search.
   *
   * @param mode - Active activity-rail sidebar mode.
   */
  collapseSidebarTreesForMode: (mode: SidebarMode) => void;
}

/**
 * React context for shared sidebar search state.
 */
export const SidebarSearchContext = createContext<SidebarSearchContextValue | null>(null);

/**
 * Returns shared sidebar search state.
 *
 * @throws When called outside `SidebarSearchProvider`.
 */
export function useSidebarSearchContext(): SidebarSearchContextValue {
  const context = useContext(SidebarSearchContext);
  if (!context) {
    throw new Error('useSidebarSearchContext must be used within SidebarSearchProvider');
  }
  return context;
}
