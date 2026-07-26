import { useMemo, type JSX } from 'react';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectArchivedCollections } from '#/renderer/src/store/selectors';
import { useSidebarSectionFilter } from '../filter/sidebarSectionFilterContext';
import { collectSidebarItemColors } from '../filter/sidebarColorFilter';
import { SidebarColorFilterButton } from '../filter/SidebarColorFilterButton';
import { SidebarSortButton } from '../sort/SidebarSortButton';

/**
 * Header actions for the Archive sidebar section (sort + color filter).
 */
export function ArchiveHeaderActions(): JSX.Element {
  const collections = useAppSelector(selectArchivedCollections);
  const { archiveColorFilter, setArchiveColorFilter } = useSidebarSectionFilter();

  /**
   * Distinct colors assigned to archived collections, sorted for the filter menu.
   */
  const colors = useMemo(() => collectSidebarItemColors(collections), [collections]);

  return (
    <>
      <SidebarSortButton
        sectionKey="archive"
        hasColorOption
        ariaLabel="Sort archive"
        title="Sort archive"
      />
      <SidebarColorFilterButton
        colors={colors}
        filter={archiveColorFilter}
        onFilterChange={setArchiveColorFilter}
        ariaLabel="Filter archive by color"
        title="Filter by color"
      />
    </>
  );
}
