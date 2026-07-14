import { Button, EmptySectionLabel, FaIcon, RowActionsMenu } from '@harborclient/sdk/components';
import { useCallback, useMemo, useState, type JSX, type MouseEvent } from 'react';
import type { RequestHistoryEntry } from '#/shared/types/requestHistory';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectRequestHistory } from '#/renderer/src/store/slices/requestHistorySlice';
import {
  clearRequestHistory,
  deleteRequestHistory,
  normalizeRequestHistoryEntry,
  openRequestHistoryRun
} from '#/renderer/src/store/thunks/requestHistory';
import { loadSavedRequest, openRequestDraft } from '#/renderer/src/plugins/hostRequestCommands';
import { useSidebarRowSelection } from '#/renderer/src/ui/sidebars/CollectionSidebar/useSidebarRowSelection';
import { faEraser, faPersonRunning } from '#/renderer/src/fontawesome';
import { METHOD_CLASSES, sourceRow, statusDotClass } from '#/renderer/src/ui/shared/classes';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/modals/dialogHelpers';
import { formatSidebarAbsoluteDate } from './utils';

/**
 * Header actions for the History sidebar section.
 */
export function HistoryHeaderActions(): JSX.Element {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const entries = useAppSelector(selectRequestHistory);
  const isEmpty = entries.length === 0;

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

  return (
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
  );
}

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
  const entries = useAppSelector(selectRequestHistory);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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
  } = useSidebarRowSelection(visibleOrder);

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
        const methodClass = METHOD_CLASSES[entry.method.toLowerCase()] ?? 'text-info';
        const normalized = normalizeRequestHistoryEntry(entry);
        const rowDate = formatSidebarAbsoluteDate(entry.ts);
        const rowTitle = isRun ? normalized.name : entry.url;
        const menuId = `history-entry-${entry.id}`;
        const selected = isSelected(entry.id);
        const showBulkMenu = selected && selectionCount > 1;

        return (
          <div
            key={entry.id}
            className={sourceRow(selected, true)}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleBeforeContextMenu(entry.id);
              setOpenMenuId(menuId);
            }}
          >
            <Button
              variant="toolbar"
              className="flex min-w-0 flex-1 items-center gap-2 py-0.5 text-left text-text hover:bg-transparent"
              title={`${rowTitle} — ${rowDate}`}
              aria-label={historyEntryAriaLabel(entry)}
              aria-selected={selected ? 'true' : undefined}
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                handleRowClick(
                  entry.id,
                  { shiftKey: event.shiftKey, ctrlOrMetaKey: event.ctrlKey || event.metaKey },
                  () => handleOpenEntry(entry)
                );
              }}
            >
              <span className={`shrink-0 font-medium uppercase ${methodClass}`} aria-hidden>
                {entry.method}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="min-w-0 truncate text-text">{normalized.name}</span>
                {isRun ? (
                  <FaIcon
                    icon={faPersonRunning}
                    className="h-3.5 w-3.5 shrink-0 text-muted"
                    aria-hidden
                  />
                ) : null}
              </span>
              {!isRun ? (
                <span className="flex shrink-0 items-center gap-1.5 tabular-nums text-muted">
                  <span
                    className={`inline-block h-2 w-2 shrink-0 rounded-full ${statusDotClass(entry.status)}`}
                    aria-hidden="true"
                  />
                  {entry.status} {entry.statusText}
                </span>
              ) : null}
            </Button>
            <RowActionsMenu
              menuId={menuId}
              openMenuId={openMenuId}
              onOpenChange={setOpenMenuId}
              groups={
                showBulkMenu
                  ? [
                      [
                        {
                          label: 'Delete',
                          variant: 'danger' as const,
                          onSelect: () => {
                            void handleDeleteSelected();
                          }
                        }
                      ]
                    ]
                  : [
                      [
                        {
                          label: 'Delete',
                          variant: 'danger',
                          onSelect: () => {
                            void handleDeleteEntry(entry);
                          }
                        }
                      ]
                    ]
              }
            />
          </div>
        );
      })}
    </div>
  );
}
