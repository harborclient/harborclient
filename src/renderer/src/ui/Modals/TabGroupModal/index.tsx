import { useCallback, type JSX } from 'react';
import toast from 'react-hot-toast';
import { PromptModal } from '@harborclient/sdk/components';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  closeTabGroupModal,
  selectTabGroupModal,
  setTabGroupModalName,
  setTabGroupModalSubmitError
} from '#/renderer/src/store/slices/modalsSlice';
import { selectRequestsByCollection } from '#/renderer/src/store/selectors';
import type { SavedRequest } from '#/shared/types';
import {
  cloneTabGroup,
  createTabGroupFromOpenTabs,
  createTabGroupFromRequests,
  renameTabGroup
} from '#/renderer/src/store/thunks/tabGroups';
import { formatErrorMessage } from '#/renderer/src/ui/Modals/dialogHelpers';

/**
 * Modal for creating, renaming, or cloning a tab group.
 */
export function TabGroupModal(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const tabGroupModal = useAppSelector(selectTabGroupModal);
  const requestsByCollection = useAppSelector(selectRequestsByCollection);

  /**
   * Closes the tab group modal and resets modal state.
   */
  const handleClose = useCallback((): void => {
    dispatch(closeTabGroupModal());
  }, [dispatch]);

  /**
   * Submits the tab group modal for create, rename, or clone.
   */
  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!tabGroupModal) {
      return;
    }

    const name = tabGroupModal.name.trim();
    if (!name) {
      return;
    }

    dispatch(setTabGroupModalSubmitError(null));

    try {
      if (tabGroupModal.mode === 'create') {
        await dispatch(createTabGroupFromOpenTabs(name)).unwrap();
        toast.success('Tab group created');
      } else if (tabGroupModal.mode === 'createFromSelection') {
        const requestIds = tabGroupModal.requestIds ?? [];
        const byId = new Map<number, SavedRequest>();
        for (const requests of Object.values(requestsByCollection)) {
          for (const request of requests) {
            byId.set(request.id, request);
          }
        }
        const selectedRequests = requestIds
          .map((id) => byId.get(id))
          .filter((request): request is SavedRequest => request != null);
        await dispatch(createTabGroupFromRequests({ name, requests: selectedRequests })).unwrap();
        toast.success('Tab group created');
      } else if (tabGroupModal.mode === 'rename' && tabGroupModal.groupId != null) {
        await dispatch(renameTabGroup({ id: tabGroupModal.groupId, name })).unwrap();
        toast.success('Tab group renamed');
      } else if (tabGroupModal.mode === 'clone' && tabGroupModal.groupId != null) {
        await dispatch(cloneTabGroup({ id: tabGroupModal.groupId, name })).unwrap();
        toast.success('Tab group cloned');
      }

      dispatch(closeTabGroupModal());
    } catch (err) {
      dispatch(
        setTabGroupModalSubmitError(
          formatErrorMessage(
            err,
            tabGroupModal.mode === 'create' || tabGroupModal.mode === 'createFromSelection'
              ? 'Failed to create tab group'
              : tabGroupModal.mode === 'rename'
                ? 'Failed to rename tab group'
                : 'Failed to clone tab group'
          )
        )
      );
    }
  }, [dispatch, requestsByCollection, tabGroupModal]);

  if (!tabGroupModal) {
    return null;
  }

  const title =
    tabGroupModal.mode === 'create' || tabGroupModal.mode === 'createFromSelection'
      ? 'Create tab group'
      : tabGroupModal.mode === 'rename'
        ? 'Rename tab group'
        : 'Clone tab group';

  const submitLabel =
    tabGroupModal.mode === 'create' || tabGroupModal.mode === 'createFromSelection'
      ? 'Create'
      : tabGroupModal.mode === 'rename'
        ? 'Save'
        : 'Clone';

  return (
    <PromptModal
      title={title}
      labelledBy="tab-group-modal-title"
      label="Tab group name"
      value={tabGroupModal.name}
      onChange={(value) => dispatch(setTabGroupModalName(value))}
      onSubmit={() => void handleSubmit()}
      onClose={handleClose}
      submitLabel={submitLabel}
      error={tabGroupModal.submitError}
    />
  );
}
