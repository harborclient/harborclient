import { useMemo, type JSX } from 'react';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectTabGroups } from '#/renderer/src/store/slices/tabGroupSlice';
import { useSidebarSectionFilter } from '../filter/sidebarSectionFilterContext';
import { collectSidebarItemColors } from '../filter/sidebarColorFilter';
import { SidebarColorFilterButton } from '../filter/SidebarColorFilterButton';
import { SidebarSortButton } from '../sort/SidebarSortButton';

/**
 * Header actions for the Tab Groups sidebar section (sort + color filter).
 */
export function TabGroupsHeaderActions(): JSX.Element {
  const groups = useAppSelector(selectTabGroups);
  const { tabGroupsColorFilter, setTabGroupsColorFilter } = useSidebarSectionFilter();

  /**
   * Distinct colors assigned to tab groups, sorted for the filter menu.
   */
  const colors = useMemo(() => collectSidebarItemColors(groups), [groups]);

  return (
    <>
      <SidebarSortButton
        sectionKey="tabGroups"
        hasColorOption
        ariaLabel="Sort tab groups"
        title="Sort tab groups"
      />
      <SidebarColorFilterButton
        colors={colors}
        filter={tabGroupsColorFilter}
        onFilterChange={setTabGroupsColorFilter}
        ariaLabel="Filter tab groups by color"
        title="Filter by color"
      />
    </>
  );
}
