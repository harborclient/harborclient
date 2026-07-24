import { EmptySectionLabel, SidebarHistoryItem } from '@harborclient/sdk/components';
import { useCallback, useMemo, useState, type JSX, type MouseEvent } from 'react';
import type { RequestHistoryEntry } from '#/shared/types/requestHistory';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectRequestsByCollection } from '#/renderer/src/store/selectors';
import { selectRequestHistory } from '#/renderer/src/store/slices/requestHistorySlice';
import {
  deleteRequestHistory,
  normalizeRequestHistoryEntry,
  openRequestHistoryRun
} from '#/renderer/src/store/thunks/requestHistory';
import { loadSavedRequest, openRequestDraft } from '#/renderer/src/plugins/hostRequestCommands';
import { useSidebarSectionFilter } from '#/renderer/src/ui/Sidebars/CollectionSidebar/filter/sidebarSectionFilterContext';
import { useSidebarRowSelection } from '#/renderer/src/ui/Sidebars/CollectionSidebar/selection/useSidebarRowSelection';
import { faPersonRunning } from '#/renderer/src/fontawesome';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/Modals/dialogHelpers';
import { type InspectPoint } from '#/renderer/src/ui/Shared/devInspectContextMenu';
import { ActionsMenu } from './ActionsMenu';
import { historyEntryCollectionId } from './historyEntryCollection';
import { formatSidebarAbsoluteDate } from './utils';

export { HistoryHeaderActions } from './HistoryHeaderActions';

/**
 * Opens a request history entry in the request editor.
 *
 * @param entry - History sidebar row to open.
 */
async function openHistoryRequestEntry(entry: RequestHistoryEntry): Promise<void> {
  const normalized = normalizeRequestHistoryEntry(entry);

  if (normalized.savedRequestId != null) {
    try {
      loadSavedRequest(normalized.savedRequestId);
      return;
    } catch {
      // Fall back to a draft tab when the saved request is not loaded in memory.
    }
  }

  openRequestDraft({
    name: normalized.name,
    method: normalized.method,
    url: normalized.url,
    headers: normalized.headers,
    params: normalized.params,
    body: normalized.body,
    bodyType: normalized.bodyType
  });
}

/**
 * Returns the accessible label for a history row.
 *
 * @param entry - History sidebar row.
 * @returns Screen-reader label describing the row action and metadata.
 */
function historyEntryAriaLabel(entry: RequestHistoryEntry): string {
  const normalized = normalizeRequestHistoryEntry(entry);
  const date = formatSidebarAbsoluteDate(entry.ts);

  if (entry.kind === 'run') {
    return `Open run ${normalized.name}, ${entry.method}, ${date}`;
  }

  return `Open ${normalized.name}, ${entry.method} ${entry.url}, status ${entry.status}, ${date}`;
}

/**
 * Sidebar section listing recent HTTP requests and collection runs.
 */
export function History(): JSX.Element {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const allEntries = useAppSelector(selectRequestHistory);
  const requestsByCollection = useAppSelector(selectRequestsByCollection);
  const { historyCollectionFilter } = useSidebarSectionFilter();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [inspectPointsByMenuId, setInspectPointsByMenuId] = useState<Record<string, InspectPoint>>(
    {}
  );

  /**
   * History entries limited to the selected collection when a filter is active.
   */
  const entries = useMemo(() => {
    if (historyCollectionFilter == null) {
      return allEntries;
    }
    return allEntries.filter(
      (entry) => historyEntryCollectionId(entry, requestsByCollection) === historyCollectionFilter
    );
  }, [allEntries, historyCollectionFilter, requestsByCollection]);

  /**
   * History entry ids in on-screen list order for shift-click range selection.
   */
  const visibleOrder = useMemo(() => entries.map((entry) => entry.id), [entries]);

  const {
    selectionCount,
    selectedOrdered,
    clearSelection,
    handleRowClick,
    handleBeforeContextMenu,
    isSelected
  } = useSidebarRowSelection(visibleOrder, { selectionKey: 'history' });

  /**
   * Opens a history entry in the request editor or collection runner.
   */
  const handleOpenEntry = useCallback(
    (entry: RequestHistoryEntry): void => {
      if (entry.kind === 'run') {
        void dispatch(openRequestHistoryRun(entry));
        return;
      }

      void openHistoryRequestEntry(entry);
    },
    [dispatch]
  );

  /**
   * Deletes a single history entry after confirmation.
   *
   * @param entry - History row to remove.
   */
  const handleDeleteEntry = useCallback(
    async (entry: RequestHistoryEntry): Promise<void> => {
      const normalized = normalizeRequestHistoryEntry(entry);
      const confirmed = await confirm({
        title: 'Delete history entry',
        message: `Delete "${normalized.name}" from history?`,
        confirmLabel: 'Delete',
        variant: 'danger'
      });
      if (confirmed) {
        void dispatch(deleteRequestHistory(entry.id));
      }
    },
    [confirm, dispatch]
  );

  /**
   * Deletes all currently multi-selected history entries after confirmation.
   */
  const handleDeleteSelected = useCallback(async (): Promise<void> => {
    if (selectedOrdered.length === 0) {
      return;
    }

    const count = selectedOrdered.length;
    const confirmed = await confirm({
      title: 'Delete history entries',
      message: `Delete ${count} selected ${count === 1 ? 'entry' : 'entries'} from history?`,
      confirmLabel: 'Delete',
      variant: 'danger'
    });
    if (!confirmed) {
      return;
    }

    try {
      for (const id of selectedOrdered) {
        await dispatch(deleteRequestHistory(id));
      }
      clearSelection();
    } catch (err) {
      showAlert(dispatch, formatErrorMessage(err, 'Failed to delete history entries'));
    }
  }, [clearSelection, confirm, dispatch, selectedOrdered]);

  return (
    <div
      className="flex flex-col gap-0.5"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          clearSelection();
        }
      }}
    >
      {entries.length === 0 ? <EmptySectionLabel label="No requests" /> : null}
      {entries.map((entry) => {
        const isRun = entry.kind === 'run';
        const normalized = normalizeRequestHistoryEntry(entry);
        const rowDate = formatSidebarAbsoluteDate(entry.ts);
        const rowTitle = isRun ? normalized.name : entry.url;
        const menuId = `history-entry-${entry.id}`;
        const selected = isSelected(entry.id);
        const showBulkMenu = selected && selectionCount > 1;

        return (
          <SidebarHistoryItem
            key={entry.id}
            method={entry.method}
            name={normalized.name ?? entry.url}
            isRun={isRun}
            status={isRun ? undefined : entry.status}
            statusText={isRun ? undefined : entry.statusText}
            runIcon={faPersonRunning}
            selected={selected}
            title={`${rowTitle} — ${rowDate}`}
            ariaLabel={historyEntryAriaLabel(entry)}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleBeforeContextMenu(entry.id);
              setInspectPointsByMenuId((prev) => ({
                ...prev,
                [menuId]: { x: event.clientX, y: event.clientY }
              }));
              setOpenMenuId(menuId);
            }}
            onClick={(event: MouseEvent<HTMLElement>) => {
              handleRowClick(
                entry.id,
                { shiftKey: event.shiftKey, ctrlOrMetaKey: event.ctrlKey || event.metaKey },
                () => handleOpenEntry(entry)
              );
            }}
            actions={
              <ActionsMenu
                entry={entry}
                showBulkMenu={showBulkMenu}
                openMenuId={openMenuId}
                onOpenChange={setOpenMenuId}
                inspectPoint={inspectPointsByMenuId[menuId]}
                onDeleteEntry={handleDeleteEntry}
                onDeleteSelected={handleDeleteSelected}
              />
            }
          />
        );
      })}
    </div>
  );
}
