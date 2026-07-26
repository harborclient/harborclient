import { useMemo, type JSX } from 'react';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectEnvironments } from '#/renderer/src/store/selectors';
import { useSidebarSectionFilter } from '../filter/sidebarSectionFilterContext';
import { collectSidebarItemColors } from '../filter/sidebarColorFilter';
import { SidebarColorFilterButton } from '../filter/SidebarColorFilterButton';
import { SidebarSortButton } from '../sort/SidebarSortButton';

/**
 * Header actions for the Environments sidebar section (sort + color filter).
 * Collects colors from all environments (not search-pruned) so the menu stays
 * complete while search is active.
 */
export function EnvironmentsHeaderActions(): JSX.Element {
  const environments = useAppSelector(selectEnvironments);
  const { environmentsColorFilter, setEnvironmentsColorFilter } = useSidebarSectionFilter();

  /**
   * Distinct colors assigned to environments, sorted for the filter menu.
   */
  const colors = useMemo(() => collectSidebarItemColors(environments), [environments]);

  return (
    <>
      <SidebarSortButton
        sectionKey="environments"
        hasColorOption
        ariaLabel="Sort environments"
        title="Sort environments"
      />
      <SidebarColorFilterButton
        colors={colors}
        filter={environmentsColorFilter}
        onFilterChange={setEnvironmentsColorFilter}
        ariaLabel="Filter environments by color"
        title="Filter by color"
      />
    </>
  );
}
