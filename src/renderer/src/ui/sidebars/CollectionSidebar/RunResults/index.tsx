import { useCallback, useMemo, useState, type JSX, type MouseEvent } from 'react';
import { Button, EmptyState, FaIcon, RowActionsMenu } from '@harborclient/sdk/components';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectRunResults } from '#/renderer/src/store/slices/runResultsSlice';
import {
  clearRunResults,
  deleteRunResult,
  openSavedRunResult
} from '#/renderer/src/store/thunks/runResults';
import { useSidebarExpansion } from '#/renderer/src/ui/sidebars/CollectionSidebar/useSidebarExpansion';
import { useSidebarProviders } from '#/renderer/src/ui/sidebars/CollectionSidebar/sidebarProvidersContext';
import { useSidebarRowSelection } from '#/renderer/src/ui/sidebars/CollectionSidebar/useSidebarRowSelection';
import { formatRelativeTime } from '#/renderer/src/ui/sidebars/CollectionSidebar/History/utils';
import { faEraser } from '#/renderer/src/fontawesome';
import { METHOD_CLASSES, sourceRow } from '#/renderer/src/ui/shared/classes';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/modals/dialogHelpers';
import { formatRunResultRowDate, runResultSummaryText, runResultStatusDotClass } from './utils';

/**
 * Header actions for the Runs sidebar section.
 */
export function RunsHeaderActions(): JSX.Element {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const runResults = useAppSelector(selectRunResults);
  const isEmpty = runResults.length === 0;

  /**
   * Clears all saved run results after confirmation.
   */
  const handleClearRuns = useCallback(async (): Promise<void> => {
    const confirmed = await confirm({
      title: 'Clear runs',
      message: 'Clear all saved runs?',
      confirmLabel: 'Clear',
      variant: 'danger'
    });
    if (confirmed) {
      void dispatch(clearRunResults());
    }
  }, [confirm, dispatch]);

  return (
    <Button
      variant="toolbar"
      className="text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
      aria-label="Clear all runs"
      disabled={isEmpty}
      onClick={() => {
        void handleClearRuns();
      }}
    >
      <FaIcon icon={faEraser} className="h-3.5 w-3.5" />
    </Button>
  );
}

/**
 * Returns the accessible label for a saved run row.
 *
 * @param rowDate - Formatted save date shown in the row.
 * @param method - HTTP method of the first request, when known.
 * @param summaryText - Pass/fail summary for screen readers.
 * @param createdAt - ISO timestamp when the run was saved.
 * @returns Screen-reader label describing the row action and metadata.
 */
function runResultAriaLabel(
  rowDate: string,
  method: string | null | undefined,
  summaryText: string,
  createdAt: string
): string {
  const time = formatRelativeTime(Date.parse(createdAt));
  if (method) {
    return `Open run ${rowDate}, ${method}, ${summaryText}, ${time}`;
  }
  return `Open run ${rowDate}, ${summaryText}, ${time}`;
}

/**
 * Saved runs list with row actions. Sources saved run results and dispatches
 * its own open/delete actions rather than receiving them from the sidebar shell.
 */
export function RunResults(): JSX.Element {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const runResults = useAppSelector(selectRunResults);
  const { connectionNamesById } = useSidebarProviders();
  const { showStorageLocationBadges } = useSidebarExpansion();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  /**
   * Run result ids in on-screen list order for shift-click range selection.
   */
  const visibleOrder = useMemo(() => runResults.map((runResult) => runResult.id), [runResults]);

  const {
    selectionCount,
    selectedOrdered,
    clearSelection,
    handleRowClick,
    handleBeforeContextMenu,
    isSelected
  } = useSidebarRowSelection(visibleOrder);

  /**
   * Opens a saved run result in the read-only collection runner tab.
   *
   * @param id - Global run result id from storage routing.
   */
  const onSelectRunResult = (id: number): void => {
    void dispatch(openSavedRunResult(id));
  };

  /**
   * Deletes a saved run result snapshot.
   *
   * @param id - Global run result id from storage routing.
   */
  const onDeleteRunResult = async (id: number): Promise<void> => {
    await dispatch(deleteRunResult(id));
  };

  /**
   * Deletes all currently multi-selected run results after confirmation.
   */
  const handleDeleteSelected = useCallback(async (): Promise<void> => {
    if (selectedOrdered.length === 0) {
      return;
    }

    const count = selectedOrdered.length;
    const confirmed = await confirm({
      title: 'Delete runs',
      message: `Delete ${count} selected run${count === 1 ? '' : 's'}?`,
      confirmLabel: 'Delete',
      variant: 'danger'
    });
    if (!confirmed) {
      return;
    }

    try {
      await Promise.all(selectedOrdered.map((id) => dispatch(deleteRunResult(id))));
      clearSelection();
    } catch (err) {
      showAlert(dispatch, formatErrorMessage(err, 'Failed to delete runs'));
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
      {runResults.length === 0 ? (
        <EmptyState variant="inline" className="pr-2 py-1.5">
          No saved runs yet
        </EmptyState>
      ) : null}

      {runResults.map((runResult) => {
        const menuId = `run-result-${runResult.id}`;
        const connectionName = connectionNamesById[runResult.connectionId] ?? null;
        const method = runResult.firstRequestMethod;
        const methodClass = METHOD_CLASSES[method?.toLowerCase() ?? ''] ?? 'text-info';
        const summaryText = runResultSummaryText(runResult.summary);
        const rowDate = formatRunResultRowDate(runResult.createdAt);
        const selected = isSelected(runResult.id);
        const showBulkMenu = selected && selectionCount > 1;

        return (
          <div
            key={runResult.id}
            className={sourceRow(selected, true)}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleBeforeContextMenu(runResult.id);
              setOpenMenuId(menuId);
            }}
          >
            <Button
              variant="toolbar"
              className="flex min-w-0 flex-1 items-center gap-2 py-0.5 text-left text-[16px] text-text hover:bg-transparent"
              data-sidebar-run-result-id={runResult.id}
              title={runResult.label}
              aria-label={runResultAriaLabel(rowDate, method, summaryText, runResult.createdAt)}
              aria-selected={selected ? 'true' : undefined}
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                handleRowClick(
                  runResult.id,
                  { shiftKey: event.shiftKey, ctrlOrMetaKey: event.ctrlKey || event.metaKey },
                  () => onSelectRunResult(runResult.id)
                );
              }}
            >
              {method ? (
                <span className={`shrink-0 font-medium uppercase ${methodClass}`} aria-hidden>
                  {method}
                </span>
              ) : null}
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="min-w-0 truncate text-[16px] text-text">{rowDate}</span>
                {showStorageLocationBadges && connectionName != null ? (
                  <span
                    className="shrink-0 rounded bg-info/15 px-1.5 py-0.5 text-[11px] font-medium text-info"
                    title={`Stored in ${connectionName}`}
                  >
                    {connectionName}
                  </span>
                ) : null}
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span
                  className={`inline-block h-2 w-2 shrink-0 rounded-full ${runResultStatusDotClass(runResult.summary)}`}
                  aria-hidden="true"
                />
                <span className="sr-only">{summaryText}</span>
              </span>
              <span className="shrink-0 text-muted">
                {formatRelativeTime(Date.parse(runResult.createdAt))}
              </span>
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
                            void (async () => {
                              const confirmed = await confirm({
                                title: 'Delete run',
                                message: `Delete saved run "${runResult.label}"?`,
                                confirmLabel: 'Delete',
                                variant: 'danger'
                              });
                              if (confirmed) {
                                void onDeleteRunResult(runResult.id);
                              }
                            })();
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
