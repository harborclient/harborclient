import { useMemo, useState, type JSX, type ReactNode } from 'react';
import {
  EMPTY_COLLECTIONS_FILTER,
  type CollectionsFilterCriteria
} from '../Collections/collectionsFilter';
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
 * Owns session-only filters for the Collections, Runs, History, Tab Groups,
 * Environments, and Archive sidebar sections so their headers and lists can
 * share the same selection without prop drilling.
 */
export function SidebarSectionFilterProvider({ children }: Props): JSX.Element {
  const [collectionsFilter, setCollectionsFilter] =
    useState<CollectionsFilterCriteria>(EMPTY_COLLECTIONS_FILTER);
  const [runsCollectionFilter, setRunsCollectionFilter] = useState<string | null>(null);
  const [historyCollectionFilter, setHistoryCollectionFilter] = useState<number | null>(null);
  const [tabGroupsColorFilter, setTabGroupsColorFilter] = useState<string | null>(null);
  const [environmentsColorFilter, setEnvironmentsColorFilter] = useState<string | null>(null);
  const [archiveColorFilter, setArchiveColorFilter] = useState<string | null>(null);

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
      tabGroupsColorFilter,
      setTabGroupsColorFilter,
      environmentsColorFilter,
      setEnvironmentsColorFilter,
      archiveColorFilter,
      setArchiveColorFilter
    }),
    [
      collectionsFilter,
      runsCollectionFilter,
      historyCollectionFilter,
      tabGroupsColorFilter,
      environmentsColorFilter,
      archiveColorFilter
    ]
  );

  return (
    <SidebarSectionFilterContext.Provider value={value}>
      {children}
    </SidebarSectionFilterContext.Provider>
  );
}
