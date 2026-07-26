import { useCallback, useEffect, useMemo, useState, type JSX, type ReactNode } from 'react';
import {
  EMPTY_COLLECTIONS_FILTER,
  type CollectionsFilterCriteria
} from '../Collections/collectionsFilter';
import { registerClearSectionFiltersHandler } from './clearRegisteredSectionFilters';
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
 * Owns session-only filters for the Collections, Runs, History, Workspaces,
 * Environments, and Archive sidebar sections so their headers and lists can
 * share the same selection without prop drilling.
 */
export function SidebarSectionFilterProvider({ children }: Props): JSX.Element {
  const [collectionsFilter, setCollectionsFilter] =
    useState<CollectionsFilterCriteria>(EMPTY_COLLECTIONS_FILTER);
  const [runsCollectionFilter, setRunsCollectionFilter] = useState<string | null>(null);
  const [historyCollectionFilter, setHistoryCollectionFilter] = useState<number | null>(null);
  const [workspacesMarkerFilter, setWorkspacesMarkerFilter] = useState<string | null>(null);
  const [environmentsMarkerFilter, setEnvironmentsMarkerFilter] = useState<string | null>(null);
  const [archiveMarkerFilter, setArchiveMarkerFilter] = useState<string | null>(null);

  /**
   * Clears every section filter so lists show unfiltered content (used when the
   * View menu hides filter controls).
   */
  const clearAllSectionFilters = useCallback((): void => {
    setCollectionsFilter(EMPTY_COLLECTIONS_FILTER);
    setRunsCollectionFilter(null);
    setHistoryCollectionFilter(null);
    setWorkspacesMarkerFilter(null);
    setEnvironmentsMarkerFilter(null);
    setArchiveMarkerFilter(null);
  }, []);

  /**
   * Publishes the clear handler so expansion toggles outside this provider can
   * reset filters when hiding filter controls.
   */
  useEffect(() => {
    return registerClearSectionFiltersHandler(clearAllSectionFilters);
  }, [clearAllSectionFilters]);

  /**
   * Memoizes the context value so consumers only re-render when a filter changes.
   */
  const value = useMemo<SidebarSectionFilterContextValue>(
    () => ({
      collectionsFilter,
      setCollectionsFilter,
      runsCollectionFilter,
      setRunsCollectionFilter,
      historyCollectionFilter,
      setHistoryCollectionFilter,
      workspacesMarkerFilter,
      setWorkspacesMarkerFilter,
      environmentsMarkerFilter,
      setEnvironmentsMarkerFilter,
      archiveMarkerFilter,
      setArchiveMarkerFilter,
      clearAllSectionFilters
    }),
    [
      archiveMarkerFilter,
      clearAllSectionFilters,
      collectionsFilter,
      environmentsMarkerFilter,
      historyCollectionFilter,
      runsCollectionFilter,
      workspacesMarkerFilter
    ]
  );

  return (
    <SidebarSectionFilterContext.Provider value={value}>
      {children}
    </SidebarSectionFilterContext.Provider>
  );
}
