import { useCallback, type JSX } from 'react';
import toast from 'react-hot-toast';
import {
  Button,
  FieldError,
  FormGroup,
  Input,
  Modal,
  ModalFooter
} from '@harborclient/sdk/components';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  closeTabGroupModal,
  selectTabGroupModal,
  setTabGroupModalName,
  setTabGroupModalSubmitError
} from '#/renderer/src/store/slices/modalsSlice';
import {
  cloneTabGroup,
  createTabGroupFromOpenTabs,
  renameTabGroup
} from '#/renderer/src/store/thunks/tabGroups';
import { formatErrorMessage } from '#/renderer/src/ui/modals/dialogHelpers';

/**
 * Modal for creating, renaming, or cloning a tab group.
 */
export function TabGroupModal(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const tabGroupModal = useAppSelector(selectTabGroupModal);

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
            tabGroupModal.mode === 'create'
              ? 'Failed to create tab group'
              : tabGroupModal.mode === 'rename'
                ? 'Failed to rename tab group'
                : 'Failed to clone tab group'
          )
        )
      );
    }
  }, [dispatch, tabGroupModal]);

  if (!tabGroupModal) {
    return null;
  }

  const title =
    tabGroupModal.mode === 'create'
      ? 'Create tab group'
      : tabGroupModal.mode === 'rename'
        ? 'Rename tab group'
        : 'Clone tab group';

  const submitLabel =
    tabGroupModal.mode === 'create' ? 'Create' : tabGroupModal.mode === 'rename' ? 'Save' : 'Clone';

  return (
    <Modal onClose={handleClose} labelledBy="tab-group-modal-title" title={title}>
      <FormGroup className="border-none! p-0!" label="Tab group name" labelTone="muted">
        <Input
          className="w-full"
          type="text"
          autoFocus
          value={tabGroupModal.name}
          onChange={(event) => dispatch(setTabGroupModalName(event.target.value))}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void handleSubmit();
            }
          }}
        />
      </FormGroup>
      {tabGroupModal.submitError ? (
        <FieldError spacing="section">{tabGroupModal.submitError}</FieldError>
      ) : null}
      <ModalFooter spaced>
        <Button onClick={() => void handleSubmit()} disabled={!tabGroupModal.name.trim()}>
          {submitLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
