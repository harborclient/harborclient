import { FilterButton } from '@harborclient/sdk/components';
import { useCallback, useRef, useState, type JSX } from 'react';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectCollections } from '#/renderer/src/store/selectors';
import { useSidebarExpansion } from '../expansion/useSidebarExpansion';
import { useSidebarSectionFilter } from '../filter/sidebarSectionFilterContext';
import { SidebarSortButton } from '../sort/SidebarSortButton';
import {
  EMPTY_COLLECTIONS_FILTER,
  isCollectionsFilterActive,
  type CollectionsFilterCriteria
} from './collectionsFilter';
import { CollectionsFilterMenu } from './CollectionsFilterMenu';

/**
 * Header actions for the Collections sidebar section (sort + multi-field filter).
 */
export function CollectionsHeaderActions(): JSX.Element {
  const collections = useAppSelector(selectCollections);
  const { showFilters } = useSidebarExpansion();
  const { collectionsFilter, setCollectionsFilter } = useSidebarSectionFilter();
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const filterActive = isCollectionsFilterActive(collectionsFilter);

  /**
   * Applies draft criteria from the filter form and closes the popover.
   *
   * @param criteria - Draft criteria to persist as the applied filter.
   */
  const handleApply = useCallback(
    (criteria: CollectionsFilterCriteria): void => {
      setCollectionsFilter(criteria);
      setMenuOpen(false);
    },
    [setCollectionsFilter]
  );

  /**
   * Clears the applied collections filter and closes the popover.
   */
  const handleClear = useCallback((): void => {
    setCollectionsFilter(EMPTY_COLLECTIONS_FILTER);
    setMenuOpen(false);
  }, [setCollectionsFilter]);

  /**
   * Closes the filter popover without changing the applied criteria.
   */
  const handleClose = useCallback((): void => {
    setMenuOpen(false);
  }, []);

  return (
    <>
      <SidebarSortButton
        sectionKey="collections"
        hasColorOption
        ariaLabel="Sort collections"
        title="Sort collections"
      />
      {showFilters && collections.length > 0 ? (
        <>
          <FilterButton
            active={filterActive}
            innerRef={triggerRef}
            aria-label="Filter collections"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            title="Filter collections"
            onClick={() => setMenuOpen((open) => !open)}
          />
          {menuOpen ? (
            <CollectionsFilterMenu
              anchorRef={triggerRef}
              appliedFilter={collectionsFilter}
              onApply={handleApply}
              onClear={handleClear}
              onClose={handleClose}
            />
          ) : null}
        </>
      ) : null}
    </>
  );
}
