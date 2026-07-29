import { EmptySectionLabel, SidebarHistoryItem } from '@harborclient/sdk/components';
import { useCallback, useMemo, useState, type JSX, type MouseEvent } from 'react';
import type { WorkflowRunHistoryEntry } from '@harborclient/core/types/workflowRunHistory';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectWorkflowRunHistory } from '#/renderer/src/store/slices/workflowRunHistorySlice';
import {
  deleteWorkflowRunHistory,
  openWorkflowRunHistory
} from '#/renderer/src/store/thunks/workflowRunHistory';
import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/expansion/useSidebarExpansion';
import { sortSidebarItems } from '#/renderer/src/ui/Sidebars/CollectionSidebar/sort/sidebarSort';
import { useSidebarRowSelection } from '#/renderer/src/ui/Sidebars/CollectionSidebar/selection/useSidebarRowSelection';
import { faDiagramProject } from '#/renderer/src/fontawesome';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/Modals/dialogHelpers';
import { type InspectPoint } from '#/renderer/src/ui/Shared/devInspectContextMenu';
import { formatSidebarAbsoluteDate } from './utils';
import { WorkflowHistoryActionsMenu } from './WorkflowHistoryActionsMenu';

/**
 * Returns the accessible label for a workflow run history row.
 *
 * @param entry - History sidebar row.
 * @returns Screen-reader label describing the row action and metadata.
 */
function workflowHistoryEntryAriaLabel(entry: WorkflowRunHistoryEntry): string {
  const date = formatSidebarAbsoluteDate(entry.ts);
  return `Open workflow run results for ${entry.name}, ${date}`;
}

/**
 * Sidebar section listing completed workflow runs that reopen the results page.
 */
export function WorkflowHistory(): JSX.Element {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const allEntries = useAppSelector(selectWorkflowRunHistory);
  const { sectionSort } = useSidebarExpansion();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [inspectPointsByMenuId, setInspectPointsByMenuId] = useState<Record<string, InspectPoint>>(
    {}
  );
  const sortMode = sectionSort.history;

  /**
   * History entries ordered by the History section sort mode.
   */
  const entries = useMemo(() => {
    return sortSidebarItems(allEntries, sortMode, {
      name: (entry) => entry.name,
      createdAt: (entry) => entry.ts
    });
  }, [allEntries, sortMode]);

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
  } = useSidebarRowSelection(visibleOrder, { selectionKey: 'workflow-history' });

  /**
   * Opens a workflow run history entry in the results page.
   *
   * @param entry - History row to open.
   */
  const handleOpenEntry = useCallback(
    (entry: WorkflowRunHistoryEntry): void => {
      void dispatch(openWorkflowRunHistory(entry));
    },
    [dispatch]
  );

  /**
   * Deletes a single history entry after confirmation.
   *
   * @param entry - History row to remove.
   */
  const handleDeleteEntry = useCallback(
    async (entry: WorkflowRunHistoryEntry): Promise<void> => {
      const confirmed = await confirm({
        title: 'Delete history entry',
        message: `Delete “${entry.name}” from history?`,
        confirmLabel: 'Delete',
        variant: 'danger'
      });
      if (confirmed) {
        void dispatch(deleteWorkflowRunHistory(entry.id));
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
        await dispatch(deleteWorkflowRunHistory(id));
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
      {entries.length === 0 ? <EmptySectionLabel label="No workflow runs" /> : null}
      {entries.map((entry) => {
        const rowDate = formatSidebarAbsoluteDate(entry.ts);
        const menuId = `workflow-history-entry-${entry.id}`;
        const selected = isSelected(entry.id);
        const showBulkMenu = selected && selectionCount > 1;

        return (
          <SidebarHistoryItem
            key={entry.id}
            method="RUN"
            name={entry.name}
            isRun
            runIcon={faDiagramProject}
            selected={selected}
            title={`${entry.name} — ${rowDate}`}
            ariaLabel={workflowHistoryEntryAriaLabel(entry)}
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
              <WorkflowHistoryActionsMenu
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
