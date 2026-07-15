import { useCallback, useMemo, useState, type JSX, type MouseEvent } from 'react';
import { EmptySectionLabel, RowActionsMenu, SidebarRunItem } from '@harborclient/sdk/components';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectRunResults } from '#/renderer/src/store/slices/runResultsSlice';
import { deleteRunResult, openSavedRunResult } from '#/renderer/src/store/thunks/runResults';
import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/useSidebarExpansion';
import { useSidebarProviders } from '#/renderer/src/ui/Sidebars/CollectionSidebar/sidebarProvidersContext';
import { useSidebarRowSelection } from '#/renderer/src/ui/Sidebars/CollectionSidebar/useSidebarRowSelection';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/Modals/dialogHelpers';
import { formatRunResultRowDate, runResultSummaryText, runResultStatusDotClass } from './utils';

export { RunsHeaderActions } from './RunsHeaderActions';

/**
 * Returns the accessible label for a saved run row.
 *
 * @param label - Saved run label shown in the row.
 * @param rowDate - Formatted save date for tooltips and screen readers.
 * @param method - HTTP method of the first request, when known.
 * @param summaryText - Pass/fail summary for screen readers.
 * @returns Screen-reader label describing the row action and metadata.
 */
function runResultAriaLabel(
  label: string,
  rowDate: string,
  method: string | null | undefined,
  summaryText: string
): string {
  if (method) {
    return `Open run ${label}, ${method}, ${summaryText}, ${rowDate}`;
  }
  return `Open run ${label}, ${summaryText}, ${rowDate}`;
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
  } = useSidebarRowSelection(visibleOrder, { selectionKey: 'run-results' });

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
      {runResults.length === 0 ? <EmptySectionLabel label="No saved runs" /> : null}

      {runResults.map((runResult) => {
        const menuId = `run-result-${runResult.id}`;
        const connectionName = connectionNamesById[runResult.connectionId] ?? null;
        const method = runResult.firstRequestMethod;
        const summaryText = runResultSummaryText(runResult.summary);
        const rowDate = formatRunResultRowDate(runResult.createdAt);
        const selected = isSelected(runResult.id);
        const showBulkMenu = selected && selectionCount > 1;

        return (
          <SidebarRunItem
            key={runResult.id}
            method={method ?? undefined}
            label={runResult.label}
            connectionBadge={
              showStorageLocationBadges && connectionName != null ? connectionName : undefined
            }
            statusDotClassName={runResultStatusDotClass(runResult.summary)}
            statusSummary={summaryText}
            selected={selected}
            title={`${runResult.label} — ${rowDate}`}
            ariaLabel={runResultAriaLabel(runResult.label, rowDate, method, summaryText)}
            dataSidebarRunResultId={runResult.id}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleBeforeContextMenu(runResult.id);
              setOpenMenuId(menuId);
            }}
            onClick={(event: MouseEvent<HTMLElement>) => {
              handleRowClick(
                runResult.id,
                { shiftKey: event.shiftKey, ctrlOrMetaKey: event.ctrlKey || event.metaKey },
                () => onSelectRunResult(runResult.id)
              );
            }}
            actions={
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
            }
          />
        );
      })}
    </div>
  );
}
