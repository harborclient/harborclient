import { Button, FaIcon, Modal, ModalFooter } from '@harborclient/sdk/components';
import { useCallback, type JSX } from 'react';

import { faCircleExclamation } from '#/renderer/src/fontawesome';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectAlertModal, setAlertModal } from '#/renderer/src/store/slices/modalsSlice';
import { openCollectionGitSettings } from '#/renderer/src/ui/Modals/dialogHelpers';

/**
 * Blocking alert dialog with OK and an optional remediation action button.
 */
export function AlertModal(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const alertModal = useAppSelector(selectAlertModal);

  /**
   * Dismisses the alert dialog.
   */
  const handleClose = useCallback((): void => {
    dispatch(setAlertModal(null));
  }, [dispatch]);

  /**
   * Runs the optional alert action after closing the dialog.
   */
  const handleAction = useCallback((): void => {
    if (alertModal?.action == null) {
      return;
    }

    const { action } = alertModal;
    dispatch(setAlertModal(null));

    if (action.kind === 'openCollectionGitSettings') {
      openCollectionGitSettings(dispatch, action.collectionId);
    }
  }, [alertModal, dispatch]);

  if (!alertModal) return null;

  const body =
    alertModal.icon === 'warning' ? (
      <div className="flex items-start gap-3">
        <FaIcon icon={faCircleExclamation} className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
        <p className="m-0 text-text">{alertModal.message}</p>
      </div>
    ) : (
      <p className="text-muted">{alertModal.message}</p>
    );

  return (
    <Modal
      className="w-150"
      onClose={handleClose}
      labelledBy="alert-modal-title"
      title={alertModal.title}
    >
      {body}
      <ModalFooter spaced>
        {alertModal.action ? (
          <Button type="button" onClick={handleAction}>
            {alertModal.action.label}
          </Button>
        ) : null}
        <Button type="button" variant="secondary" onClick={handleClose}>
          OK
        </Button>
      </ModalFooter>
    </Modal>
  );
}
