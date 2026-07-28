import {
  EmptySectionLabel,
  RowActionsMenu,
  SidebarWorkspaceItem
} from '@harborclient/sdk/components';
import { useCallback, useMemo, useState, type JSX, type MouseEvent } from 'react';
import type { Workflow } from '@harborclient/core/types';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectWorkflows } from '#/renderer/src/store/slices/workflowsSlice';
import { deleteWorkflow, exportWorkflow } from '#/renderer/src/store/thunks/workflows';
import { faDiagramProject } from '#/renderer/src/fontawesome';
import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/expansion/useSidebarExpansion';
import {
  sortSidebarItems,
  toSortTimestamp
} from '#/renderer/src/ui/Sidebars/CollectionSidebar/sort/sidebarSort';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/Modals/dialogHelpers';
import { formatWorkflowDuration } from '#/renderer/src/workflows/formatWorkflowDuration';

/**
 * Workflows sidebar section listing saved recordings with export and delete actions.
 */
export function Workflows(): JSX.Element {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const allWorkflows = useAppSelector(selectWorkflows);
  const { sectionSort } = useSidebarExpansion();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const sortMode = sectionSort.workflows;

  /**
   * Workflows ordered by the Workflows section sort mode.
   */
  const workflows = useMemo(() => {
    return sortSidebarItems(allWorkflows, sortMode, {
      name: (workflow) => workflow.name,
      createdAt: (workflow) => toSortTimestamp(workflow.createdAt)
    });
  }, [allWorkflows, sortMode]);

  /**
   * Deletes one workflow after confirmation.
   *
   * @param workflow - Workflow to trash.
   */
  const handleDelete = useCallback(
    async (workflow: Workflow): Promise<void> => {
      const confirmed = await confirm({
        title: 'Delete workflow',
        message: `Move “${workflow.name}” to the trash?`,
        confirmLabel: 'Delete',
        variant: 'danger'
      });
      if (!confirmed) {
        return;
      }
      try {
        await dispatch(deleteWorkflow(workflow.id)).unwrap();
      } catch (error) {
        showAlert(dispatch, formatErrorMessage(error, 'Failed to delete workflow'));
      }
    },
    [confirm, dispatch]
  );

  return (
    <div className="flex flex-col gap-0.5 px-1 pb-1">
      {workflows.length === 0 ? <EmptySectionLabel label="No workflows" /> : null}
      {workflows.map((workflow) => {
        const menuId = `workflow-${workflow.id}`;
        return (
          <SidebarWorkspaceItem
            key={workflow.id}
            name={workflow.name}
            summary={formatWorkflowDuration(workflow.durationMs)}
            icon={faDiagramProject}
            selected={false}
            actions={
              <RowActionsMenu
                menuId={menuId}
                openMenuId={openMenuId}
                onOpenChange={setOpenMenuId}
                groups={[
                  [
                    {
                      label: 'Export',
                      onSelect: () => {
                        void dispatch(exportWorkflow(workflow.id));
                      }
                    }
                  ],
                  [
                    {
                      label: 'Delete',
                      variant: 'danger',
                      onSelect: () => {
                        void handleDelete(workflow);
                      }
                    }
                  ]
                ]}
              />
            }
            onClick={(event: MouseEvent) => {
              event.preventDefault();
            }}
            onContextMenu={(event: MouseEvent) => {
              event.preventDefault();
              setOpenMenuId(menuId);
            }}
          />
        );
      })}
    </div>
  );
}
