import { Button, FaIcon, RowActionsMenu } from '@harborclient/sdk/components';
import { useCallback, useMemo, useState, type JSX } from 'react';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectCollections, selectRequestsByCollection } from '#/renderer/src/store/selectors';
import { selectRequestHistory } from '#/renderer/src/store/slices/requestHistorySlice';
import { clearRequestHistory } from '#/renderer/src/store/thunks/requestHistory';
import { faEraser, faFilter } from '#/renderer/src/fontawesome';
import { useSidebarSectionFilter } from '../filter/sidebarSectionFilterContext';
import { historyEntryCollectionId } from './historyEntryCollection';

const HISTORY_FILTER_MENU_ID = 'history-collection-filter';

/**
 * Header actions for the History sidebar section (clear + collection filter).
 */
export function HistoryHeaderActions(): JSX.Element {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const entries = useAppSelector(selectRequestHistory);
  const collections = useAppSelector(selectCollections);
  const requestsByCollection = useAppSelector(selectRequestsByCollection);
  const { historyCollectionFilter, setHistoryCollectionFilter } = useSidebarSectionFilter();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const isEmpty = entries.length === 0;

  /**
   * Distinct collections present in the current History list, sorted by name.
   */
  const collectionsInHistory = useMemo(() => {
    const ids = new Set<number>();
    for (const entry of entries) {
      const collectionId = historyEntryCollectionId(entry, requestsByCollection);
      if (collectionId != null) {
        ids.add(collectionId);
      }
    }

    const nameById = new Map(collections.map((collection) => [collection.id, collection.name]));
    return [...ids]
      .map((id) => ({
        id,
        name: nameById.get(id) ?? `Collection ${id}`
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [collections, entries, requestsByCollection]);

  /**
   * Clears all request history entries after confirmation.
   */
  const handleClearHistory = useCallback(async (): Promise<void> => {
    const confirmed = await confirm({
      title: 'Clear history',
      message: 'Clear all request history?',
      confirmLabel: 'Clear',
      variant: 'danger'
    });
    if (confirmed) {
      void dispatch(clearRequestHistory());
    }
  }, [confirm, dispatch]);

  /**
   * Filter menu groups with a checkmark on the active collection (or All).
   */
  const filterMenuGroups = useMemo(
    () => [
      [
        {
          label: 'All collections',
          checked: historyCollectionFilter == null,
          onSelect: () => setHistoryCollectionFilter(null)
        },
        ...collectionsInHistory.map((collection) => ({
          label: collection.name,
          checked: historyCollectionFilter === collection.id,
          onSelect: () =>
            setHistoryCollectionFilter(
              historyCollectionFilter === collection.id ? null : collection.id
            )
        }))
      ]
    ],
    [collectionsInHistory, historyCollectionFilter, setHistoryCollectionFilter]
  );

  const filterActive = historyCollectionFilter != null;

  return (
    <>
      <Button
        variant="toolbar"
        className="text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Clear request history"
        disabled={isEmpty}
        onClick={() => {
          void handleClearHistory();
        }}
      >
        <FaIcon icon={faEraser} className="h-3.5 w-3.5" />
      </Button>
      {collectionsInHistory.length > 0 ? (
        <RowActionsMenu
          menuId={HISTORY_FILTER_MENU_ID}
          openMenuId={openMenuId}
          onOpenChange={setOpenMenuId}
          triggerVariant="toolbar"
          triggerIcon={faFilter}
          triggerAriaLabel="Filter history by collection"
          triggerTitle="Filter by collection"
          triggerClassName={
            filterActive ? 'text-text hover:text-text' : 'text-muted hover:text-text'
          }
          groups={filterMenuGroups}
        />
      ) : null}
    </>
  );
}
