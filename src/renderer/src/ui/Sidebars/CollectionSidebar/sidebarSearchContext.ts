import { createContext, useContext, type Dispatch, type SetStateAction } from 'react';
import type { SidebarSearchFilter } from '#/shared/search/sidebar';

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
   * Convenience flag: true when a search filter is active.
   */
  searchActive: boolean;

  /**
   * True while a non-empty query is active and some collection contents load.
   */
  searchLoading: boolean;

  /**
   * Collapses all collection and folder trees and clears active search.
   */
  collapseAllSidebarTrees: () => void;
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
