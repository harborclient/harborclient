import { useMemo, type JSX } from 'react';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectEnvironments } from '#/renderer/src/store/selectors';
import { useSidebarSectionFilter } from '../filter/sidebarSectionFilterContext';
import { collectSidebarItemMarkers } from '../filter/sidebarMarkerFilter';
import { SidebarMarkerFilterButton } from '../filter/SidebarMarkerFilterButton';
import { SidebarSortButton } from '../sort/SidebarSortButton';

/**
 * Header actions for the Environments sidebar section (sort + marker filter).
 * Collects markers from all environments (not search-pruned) so the menu stays
 * complete while search is active.
 */
export function EnvironmentsHeaderActions(): JSX.Element {
  const environments = useAppSelector(selectEnvironments);
  const { environmentsMarkerFilter, setEnvironmentsMarkerFilter } = useSidebarSectionFilter();

  /**
   * Distinct markers assigned to environments, sorted for the filter menu.
   */
  const markers = useMemo(() => collectSidebarItemMarkers(environments), [environments]);

  return (
    <>
      <SidebarSortButton
        sectionKey="environments"
        hasMarkerOption
        ariaLabel="Sort environments"
        title="Sort environments"
      />
      <SidebarMarkerFilterButton
        markers={markers}
        filter={environmentsMarkerFilter}
        onFilterChange={setEnvironmentsMarkerFilter}
        ariaLabel="Filter environments by color marker"
        title="Filter by color marker"
      />
    </>
  );
}
