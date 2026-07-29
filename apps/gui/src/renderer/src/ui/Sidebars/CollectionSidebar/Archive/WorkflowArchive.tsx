import { EmptySectionLabel, SIDEBAR_ITEM_BUTTON_CLASS } from '@harborclient/sdk/components';
import { useCallback, useMemo, useState, type JSX } from 'react';
import type { Workflow } from '@harborclient/core/types';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectArchivedWorkflows } from '#/renderer/src/store/selectors';
import { deleteWorkflow, setWorkflowArchived } from '#/renderer/src/store/thunks/workflows';
import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/expansion/useSidebarExpansion';
import {
  sortSidebarItems,
  toSortTimestamp
} from '#/renderer/src/ui/Sidebars/CollectionSidebar/sort/sidebarSort';
import { sourceRow } from '#/renderer/src/ui/Shared/classes';
import { type InspectPoint } from '#/renderer/src/ui/Shared/devInspectContextMenu';
import { WorkflowArchiveActionsMenu } from './WorkflowArchiveActionsMenu';
import toast from 'react-hot-toast';

/**
 * Returns the accessible label for an archived workflow row.
 *
 * @param workflow - Archived workflow row.
 */
function archivedWorkflowAriaLabel(workflow: Pick<Workflow, 'name'>): string {
  return `${workflow.name}, archived workflow`;
}

/**
 * Sidebar section listing archived workflows that can be restored or deleted.
 */
export function WorkflowArchive(): JSX.Element {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const allWorkflows = useAppSelector(selectArchivedWorkflows);
  const { sectionSort } = useSidebarExpansion();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [inspectPointsByMenuId, setInspectPointsByMenuId] = useState<Record<string, InspectPoint>>(
    {}
  );
  const sortMode = sectionSort.archive;

  /**
   * Archived workflows ordered by the Archive section sort mode.
   */
  const workflows = useMemo(() => {
    return sortSidebarItems(allWorkflows, sortMode, {
      name: (workflow) => workflow.name,
      createdAt: (workflow) => toSortTimestamp(workflow.createdAt)
    });
  }, [allWorkflows, sortMode]);

  /**
   * Restores one archived workflow to the Workflows list after confirmation.
   *
   * @param workflow - Archived workflow to restore.
   */
  const handleRestore = useCallback(
    async (workflow: Pick<Workflow, 'id' | 'name'>): Promise<void> => {
      const confirmed = await confirm({
        title: 'Restore workflow',
        message: `Restore “${workflow.name}” to Workflows?`,
        confirmLabel: 'Restore'
      });
      if (!confirmed) {
        return;
      }
      await dispatch(setWorkflowArchived({ id: workflow.id, archived: false }));
      toast.success(`Restored workflow “${workflow.name}”`);
    },
    [confirm, dispatch]
  );

  /**
   * Moves one archived workflow to trash after confirmation.
   *
   * @param workflow - Archived workflow to delete.
   */
  const handleDelete = useCallback(
    async (workflow: Pick<Workflow, 'id' | 'name'>): Promise<void> => {
      const confirmed = await confirm({
        title: 'Delete workflow',
        message: `Move “${workflow.name}” to trash?`,
        confirmLabel: 'Delete',
        variant: 'danger'
      });
      if (!confirmed) {
        return;
      }
      await dispatch(deleteWorkflow(workflow.id));
    },
    [confirm, dispatch]
  );

  if (allWorkflows.length === 0) {
    return (
      <div className="flex flex-col gap-0.5">
        <EmptySectionLabel label="No archived workflows" />
      </div>
    );
  }

  return (
    <div className="sidebar-source-list flex flex-col gap-0.5 pb-1">
      {workflows.map((workflow) => {
        const menuId = `archive-workflow-${workflow.id}`;

        return (
          <div
            key={workflow.id}
            className={sourceRow(false, true)}
            data-sidebar-archive-workflow-id={workflow.id}
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
              aria-label={archivedWorkflowAriaLabel(workflow)}
            >
              <span className="min-w-0 flex-1 truncate text-text">{workflow.name}</span>
            </button>
            <WorkflowArchiveActionsMenu
              workflow={workflow}
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
