import { Button, FaIcon } from '@harborclient/sdk/components';
import { useCallback, useMemo, type JSX } from 'react';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectArchivedCollections } from '#/renderer/src/store/selectors';
import { emptyArchive } from '#/renderer/src/store/thunks/collections';
import { faEraser } from '#/renderer/src/fontawesome';
import { useSidebarSectionFilter } from '../filter/sidebarSectionFilterContext';
import { collectSidebarItemMarkers } from '../filter/sidebarMarkerFilter';
import { SidebarMarkerFilterButton } from '../filter/SidebarMarkerFilterButton';
import { SidebarSortButton } from '../sort/SidebarSortButton';

/**
 * Header actions for the Archive sidebar section (sort, marker filter, empty archive).
 */
export function ArchiveHeaderActions(): JSX.Element {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const collections = useAppSelector(selectArchivedCollections);
  const { archiveMarkerFilter, setArchiveMarkerFilter } = useSidebarSectionFilter();
  const isEmpty = collections.length === 0;

  /**
   * Distinct markers assigned to archived collections, sorted for the filter menu.
   */
  const markers = useMemo(() => collectSidebarItemMarkers(collections), [collections]);

  /**
   * Moves every archived collection to trash after confirmation.
   */
  const handleEmptyArchive = useCallback(async (): Promise<void> => {
    const confirmed = await confirm({
      title: 'Empty archive',
      message: 'Move all archived collections to trash?',
      confirmLabel: 'Empty archive',
      variant: 'danger'
    });
    if (confirmed) {
      void dispatch(emptyArchive());
    }
  }, [confirm, dispatch]);

  return (
    <>
      <SidebarSortButton
        sectionKey="archive"
        hasMarkerOption
        ariaLabel="Sort archive"
        title="Sort archive"
      />
      <SidebarMarkerFilterButton
        markers={markers}
        filter={archiveMarkerFilter}
        onFilterChange={setArchiveMarkerFilter}
        ariaLabel="Filter archive by color marker"
        title="Filter by color marker"
      />
      <Button
        variant="toolbar"
        className="text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Empty archive"
        title="Empty archive"
        disabled={isEmpty}
        onClick={() => {
          void handleEmptyArchive();
        }}
      >
        <FaIcon icon={faEraser} className="h-3.5 w-3.5" />
      </Button>
    </>
  );
}
