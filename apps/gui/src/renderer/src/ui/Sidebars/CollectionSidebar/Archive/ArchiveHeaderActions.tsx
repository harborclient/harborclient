import { Button, FaIcon } from '@harborclient/sdk/components';
import { useCallback, useMemo, type JSX } from 'react';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectArchivedCollections } from '#/renderer/src/store/selectors';
import { emptyArchive } from '#/renderer/src/store/thunks/collections';
import { faEraser } from '#/renderer/src/fontawesome';
import { useSidebarSectionFilter } from '../filter/sidebarSectionFilterContext';
import { collectSidebarItemColors } from '../filter/sidebarColorFilter';
import { SidebarColorFilterButton } from '../filter/SidebarColorFilterButton';
import { SidebarSortButton } from '../sort/SidebarSortButton';

/**
 * Header actions for the Archive sidebar section (sort, color filter, empty archive).
 */
export function ArchiveHeaderActions(): JSX.Element {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const collections = useAppSelector(selectArchivedCollections);
  const { archiveColorFilter, setArchiveColorFilter } = useSidebarSectionFilter();
  const isEmpty = collections.length === 0;

  /**
   * Distinct colors assigned to archived collections, sorted for the filter menu.
   */
  const colors = useMemo(() => collectSidebarItemColors(collections), [collections]);

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
