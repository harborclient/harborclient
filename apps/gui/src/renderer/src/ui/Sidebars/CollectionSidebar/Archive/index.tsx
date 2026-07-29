import { EmptySectionLabel, SIDEBAR_ITEM_BUTTON_CLASS } from '@harborclient/sdk/components';
import { useCallback, useMemo, useState, type JSX } from 'react';
import type { Collection } from '@harborclient/core/types';
import { formatArchivedCollectionLabel } from '@harborclient/core/search/sidebar';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectArchivedCollections } from '#/renderer/src/store/selectors';
import { deleteCollection, setCollectionArchived } from '#/renderer/src/store/thunks/collections';
import { SidebarMarkerDot } from '#/renderer/src/ui/Sidebars/CollectionSidebar/markers/SidebarMarkerDot';
import { useSidebarSectionFilter } from '#/renderer/src/ui/Sidebars/CollectionSidebar/filter/sidebarSectionFilterContext';
import { filterItemsByMarker } from '#/renderer/src/ui/Sidebars/CollectionSidebar/filter/sidebarMarkerFilter';
import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/expansion/useSidebarExpansion';
import {
  sortSidebarItems,
  toSortTimestamp
} from '#/renderer/src/ui/Sidebars/CollectionSidebar/sort/sidebarSort';
import { useSidebarSearchContext } from '#/renderer/src/ui/Sidebars/CollectionSidebar/search/sidebarSearchContext';
import { sourceRow } from '#/renderer/src/ui/Shared/classes';
import { type InspectPoint } from '#/renderer/src/ui/Shared/devInspectContextMenu';
import { ActionsMenu } from './ActionsMenu';

export { ArchiveHeaderActions } from './ArchiveHeaderActions';

/**
 * Returns the accessible label for an archived collection row.
 *
 * @param collection - Archived collection row.
 * @param searchActive - Whether sidebar search is filtering the Archive list.
 */
function archivedCollectionAriaLabel(
  collection: Pick<Collection, 'name'>,
  searchActive: boolean
): string {
  if (searchActive) {
    return `${formatArchivedCollectionLabel(collection.name)}, archived collection`;
  }
  return `${collection.name}, archived collection`;
}

/**
 * Sidebar section listing archived collections that can be restored or deleted.
 * Respects sidebar text search and the Archive marker filter when active.
 */
export function Archive(): JSX.Element {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const allCollections = useAppSelector(selectArchivedCollections);
  const { archiveMarkerFilter } = useSidebarSectionFilter();
  const { sectionSort } = useSidebarExpansion();
  const { searchActive, archivedSearchFilter } = useSidebarSearchContext();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [inspectPointsByMenuId, setInspectPointsByMenuId] = useState<Record<string, InspectPoint>>(
    {}
  );
  const sortMode = sectionSort.archive;

  /**
   * Archived collections limited by sidebar search and optional marker filter,
   * then ordered by the Archive section sort mode.
   */
  const collections = useMemo(() => {
    const searchMatched =
      archivedSearchFilter == null
        ? allCollections
        : allCollections.filter((collection) =>
            archivedSearchFilter.collectionIds.has(collection.id)
          );
    const filtered = filterItemsByMarker(searchMatched, archiveMarkerFilter);
    return sortSidebarItems(filtered, sortMode, {
      name: (collection) => collection.name,
      createdAt: (collection) => toSortTimestamp(collection.created_at),
      marker: (collection) => collection.marker
    });
  }, [allCollections, archiveMarkerFilter, archivedSearchFilter, sortMode]);

  /**
   * True when a search or marker filter is active but no archived collections matched.
   */
  const filterActive = searchActive || archiveMarkerFilter != null;
  const noMatches = filterActive && allCollections.length > 0 && collections.length === 0;

  /**
   * Restores one archived collection to the Collections tree after confirmation.
   *
   * @param collection - Archived collection to restore.
   */
  const handleRestore = useCallback(
    async (collection: Pick<Collection, 'id' | 'name'>): Promise<void> => {
      const confirmed = await confirm({
        title: 'Restore collection',
        message: `Restore "${collection.name}" to Collections?`,
        confirmLabel: 'Restore'
      });
      if (!confirmed) {
        return;
      }
      await dispatch(setCollectionArchived({ id: collection.id, archived: false }));
    },
    [confirm, dispatch]
  );

  /**
   * Moves one archived collection to trash after confirmation.
   *
   * @param collection - Archived collection to delete.
   */
  const handleDelete = useCallback(
    async (collection: Pick<Collection, 'id' | 'name'>): Promise<void> => {
      const confirmed = await confirm({
        title: 'Delete collection',
        message: `Move "${collection.name}" to trash?`,
        confirmLabel: 'Delete',
        variant: 'danger'
      });
      if (!confirmed) {
        return;
      }
      await dispatch(deleteCollection(collection.id));
    },
    [confirm, dispatch]
  );

  if (allCollections.length === 0) {
    return (
      <div className="flex flex-col gap-0.5">
        <EmptySectionLabel label="No archived collections" />
      </div>
    );
  }

  if (noMatches) {
    return <div className="px-2 py-1.5 text-muted">No matching archived collections</div>;
  }

  return (
    <div className="sidebar-source-list flex flex-col gap-0.5 pb-1">
      {collections.map((collection) => {
        const menuId = `archive-collection-${collection.id}`;
        const displayName = searchActive
          ? formatArchivedCollectionLabel(collection.name)
          : collection.name;

        return (
          <div
            key={collection.id}
            className={sourceRow(false, true)}
            data-sidebar-archive-id={collection.id}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setInspectPointsByMenuId((prev) => ({
                ...prev,
                [menuId]: { x: event.clientX, y: event.clientY }
              }));
              setOpenMenuId(menuId);
            }}
          >
            <button
              type="button"
              className={`${SIDEBAR_ITEM_BUTTON_CLASS} items-center gap-2 px-2 py-1.5`}
              aria-label={archivedCollectionAriaLabel(collection, searchActive)}
            >
              <span className="inline-flex min-w-0 flex-1 items-center gap-1.5">
                <span className="min-w-0 truncate text-text">{displayName}</span>
                <SidebarMarkerDot marker={collection.marker} />
              </span>
            </button>
            <ActionsMenu
              collection={collection}
              openMenuId={openMenuId}
              onOpenChange={setOpenMenuId}
              inspectPoint={inspectPointsByMenuId[menuId]}
              onRestore={handleRestore}
              onDelete={handleDelete}
            />
          </div>
        );
      })}
    </div>
  );
}
