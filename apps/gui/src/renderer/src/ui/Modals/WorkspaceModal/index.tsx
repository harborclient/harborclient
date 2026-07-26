import { useCallback, type JSX } from 'react';
import toast from 'react-hot-toast';
import { PromptModal } from '@harborclient/sdk/components';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  closeWorkspaceModal,
  selectWorkspaceModal,
  setWorkspaceModalName,
  setWorkspaceModalSubmitError
} from '#/renderer/src/store/slices/modalsSlice';
import { selectRequestsByCollection } from '#/renderer/src/store/selectors';
import type { SavedRequest } from '@harborclient/core/types';
import {
  cloneWorkspace,
  createWorkspaceFromOpenTabs,
  createWorkspaceFromRequests,
  renameWorkspace
} from '#/renderer/src/store/thunks/workspaces';
import { formatErrorMessage } from '#/renderer/src/ui/Modals/dialogHelpers';

/**
 * Modal for creating, renaming, or cloning a workspace.
 */
export function WorkspaceModal(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const workspaceModal = useAppSelector(selectWorkspaceModal);
  const requestsByCollection = useAppSelector(selectRequestsByCollection);

  /**
   * Closes the workspace modal and resets modal state.
   */
  const handleClose = useCallback((): void => {
    dispatch(closeWorkspaceModal());
  }, [dispatch]);

  /**
   * Submits the workspace modal for create, rename, or clone.
   */
  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!workspaceModal) {
      return;
    }

    const name = workspaceModal.name.trim();
    if (!name) {
      return;
    }

    dispatch(setWorkspaceModalSubmitError(null));

    try {
      if (workspaceModal.mode === 'create') {
        await dispatch(createWorkspaceFromOpenTabs(name)).unwrap();
        toast.success('Workspace created');
      } else if (workspaceModal.mode === 'createFromSelection') {
        const requestIds = workspaceModal.requestIds ?? [];
        const byId = new Map<number, SavedRequest>();
        for (const requests of Object.values(requestsByCollection)) {
          for (const request of requests) {
            byId.set(request.id, request);
          }
        }
        const selectedRequests = requestIds
          .map((id) => byId.get(id))
          .filter((request): request is SavedRequest => request != null);
        await dispatch(createWorkspaceFromRequests({ name, requests: selectedRequests })).unwrap();
        toast.success('Workspace created');
      } else if (workspaceModal.mode === 'rename' && workspaceModal.groupId != null) {
        await dispatch(renameWorkspace({ id: workspaceModal.groupId, name })).unwrap();
        toast.success('Workspace renamed');
      } else if (workspaceModal.mode === 'clone' && workspaceModal.groupId != null) {
        await dispatch(cloneWorkspace({ id: workspaceModal.groupId, name })).unwrap();
        toast.success('Workspace cloned');
      }

      dispatch(closeWorkspaceModal());
    } catch (err) {
      dispatch(
        setWorkspaceModalSubmitError(
          formatErrorMessage(
            err,
            workspaceModal.mode === 'create' || workspaceModal.mode === 'createFromSelection'
              ? 'Failed to create workspace'
              : workspaceModal.mode === 'rename'
                ? 'Failed to rename workspace'
                : 'Failed to clone workspace'
          )
        )
      );
    }
  }, [dispatch, requestsByCollection, workspaceModal]);

  if (!workspaceModal) {
    return null;
  }

  const title =
    workspaceModal.mode === 'create' || workspaceModal.mode === 'createFromSelection'
      ? 'Create workspace'
      : workspaceModal.mode === 'rename'
        ? 'Rename workspace'
        : 'Clone workspace';

  const submitLabel =
    workspaceModal.mode === 'create' || workspaceModal.mode === 'createFromSelection'
      ? 'Create'
      : workspaceModal.mode === 'rename'
        ? 'Save'
        : 'Clone';

  return (
    <PromptModal
      title={title}
      labelledBy="tab-group-modal-title"
      label="Workspace name"
      value={workspaceModal.name}
      onChange={(value) => dispatch(setWorkspaceModalName(value))}
      onSubmit={() => void handleSubmit()}
      onClose={handleClose}
      submitLabel={submitLabel}
      error={workspaceModal.submitError}
    />
  );
}
