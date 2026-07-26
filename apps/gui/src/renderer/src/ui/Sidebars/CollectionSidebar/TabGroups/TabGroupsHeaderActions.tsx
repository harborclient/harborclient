import { useMemo, type JSX } from 'react';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectTabGroups } from '#/renderer/src/store/slices/tabGroupSlice';
import { useSidebarSectionFilter } from '../filter/sidebarSectionFilterContext';
import { collectSidebarItemMarkers } from '../filter/sidebarMarkerFilter';
import { SidebarMarkerFilterButton } from '../filter/SidebarMarkerFilterButton';
import { SidebarSortButton } from '../sort/SidebarSortButton';

/**
 * Header actions for the Tab Groups sidebar section (sort + marker filter).
 */
export function TabGroupsHeaderActions(): JSX.Element {
  const groups = useAppSelector(selectTabGroups);
  const { tabGroupsMarkerFilter, setTabGroupsMarkerFilter } = useSidebarSectionFilter();

  /**
   * Distinct markers assigned to tab groups, sorted for the filter menu.
   */
  const markers = useMemo(() => collectSidebarItemMarkers(groups), [groups]);

  return (
    <>
      <SidebarSortButton
        sectionKey="tabGroups"
        hasMarkerOption
        ariaLabel="Sort tab groups"
        title="Sort tab groups"
      />
      <SidebarMarkerFilterButton
        markers={markers}
        filter={tabGroupsMarkerFilter}
        onFilterChange={setTabGroupsMarkerFilter}
        ariaLabel="Filter tab groups by color marker"
        title="Filter by color marker"
      />
    </>
  );
}
