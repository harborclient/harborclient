import {
  EmptySectionLabel,
  RowActionsMenu,
  SidebarWorkspaceItem
} from '@harborclient/sdk/components';
import { useCallback, useMemo, useState, type JSX, type MouseEvent } from 'react';
import toast from 'react-hot-toast';
import type { Workflow } from '@harborclient/core/types';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectActiveWorkflows } from '#/renderer/src/store/selectors';
import {
  openWorkflowEditDialog,
  openWorkflowPlayDialog,
  selectPlaybackWorkflowId,
  selectWorkflowDialogMode
} from '#/renderer/src/store/slices/workflowsSlice';
import {
  deleteWorkflow,
  exportWorkflow,
  setWorkflowArchived
} from '#/renderer/src/store/thunks/workflows';
import { faDiagramProject } from '#/renderer/src/fontawesome';
import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/expansion/useSidebarExpansion';
import { buildCopyIdMenuItem } from '#/renderer/src/ui/Sidebars/CollectionSidebar/menus/copyEntityId';
import {
  sortSidebarItems,
  toSortTimestamp
} from '#/renderer/src/ui/Sidebars/CollectionSidebar/sort/sidebarSort';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/Modals/dialogHelpers';
import { formatWorkflowDuration } from '#/renderer/src/workflows/formatWorkflowDuration';
import {
  clearSession,
  getSessionEvents,
  isRecording,
  stopRecording
} from '#/renderer/src/workflows/workflowRecorder';
import { clearPlayback, stopPlayback } from '#/renderer/src/workflows/workflowPlayback';

/**
 * Workflows sidebar section listing saved recordings with play, edit, copy-id, export, archive, and delete actions.
 */
export function Workflows(): JSX.Element {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const allWorkflows = useAppSelector(selectActiveWorkflows);
  const playbackWorkflowId = useAppSelector(selectPlaybackWorkflowId);
  const dialogMode = useAppSelector(selectWorkflowDialogMode);
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

  /**
   * Archives one workflow after confirmation.
   *
   * @param workflow - Workflow to archive.
   */
  const handleArchive = useCallback(
    async (workflow: Workflow): Promise<void> => {
      try {
        await dispatch(setWorkflowArchived({ id: workflow.id, archived: true })).unwrap();
        toast.success(`Archived workflow “${workflow.name}”`);
      } catch (error) {
        showAlert(dispatch, formatErrorMessage(error, 'Failed to archive workflow'));
      }
    },
    [dispatch]
  );

  /**
   * Confirms discard of an unsaved recording, then stops any active playback session.
   *
   * @returns True when the caller may open another workflow panel.
   */
  const prepareOpenWorkflowDialog = useCallback(async (): Promise<boolean> => {
    const hasUnsavedRecording = isRecording() || getSessionEvents().length > 0;
    if (hasUnsavedRecording) {
      const confirmed = await confirm({
        title: 'Discard recording?',
        message: 'Opening a workflow will discard the unsaved recording session.',
        confirmLabel: 'Discard',
        variant: 'danger'
      });
      if (!confirmed) {
        return false;
      }
      stopRecording();
      clearSession();
    }

    stopPlayback();
    clearPlayback();
    return true;
  }, [confirm]);

  /**
   * Opens the play panel for a workflow, discarding an unsaved recording when needed.
   *
   * @param workflow - Workflow to play.
   */
  const handleOpenPlay = useCallback(
    async (workflow: Workflow): Promise<void> => {
      const ready = await prepareOpenWorkflowDialog();
      if (!ready) {
        return;
      }
      dispatch(openWorkflowPlayDialog(workflow.id));
    },
    [dispatch, prepareOpenWorkflowDialog]
  );

  /**
   * Opens the timeline editor for a workflow, discarding an unsaved recording when needed.
   *
   * @param workflow - Workflow to edit.
   */
  const handleOpenEdit = useCallback(
    async (workflow: Workflow): Promise<void> => {
      const ready = await prepareOpenWorkflowDialog();
      if (!ready) {
        return;
      }
      dispatch(openWorkflowEditDialog(workflow.id));
    },
    [dispatch, prepareOpenWorkflowDialog]
  );

  return (
    <div className="flex flex-col gap-0.5 px-1 pb-1">
      {workflows.length === 0 ? <EmptySectionLabel label="No workflows" /> : null}
      {workflows.map((workflow) => {
        const menuId = `workflow-${workflow.id}`;
        const selected =
          (dialogMode === 'play' || dialogMode === 'edit') && playbackWorkflowId === workflow.id;
        return (
          <SidebarWorkspaceItem
            key={workflow.id}
            name={workflow.name}
            summary={formatWorkflowDuration(workflow.durationMs)}
            icon={faDiagramProject}
            selected={selected}
            actions={
              <RowActionsMenu
                menuId={menuId}
                openMenuId={openMenuId}
                onOpenChange={setOpenMenuId}
                groups={[
                  [
                    {
                      label: 'Edit',
                      onSelect: () => {
                        void handleOpenEdit(workflow);
                      }
                    },
                    buildCopyIdMenuItem(workflow.uuid),
                    {
                      label: 'Export',
                      onSelect: () => {
                        void dispatch(exportWorkflow(workflow.id));
                      }
                    },
                    {
                      label: 'Archive',
                      onSelect: () => {
                        void handleArchive(workflow);
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
              void handleOpenPlay(workflow);
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
