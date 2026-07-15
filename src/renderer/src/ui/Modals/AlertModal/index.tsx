import { FaIcon, Modal } from '@harborclient/sdk/components';
import { useCallback, type JSX } from 'react';

import { faCircleExclamation } from '#/renderer/src/fontawesome';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectAlertModal, setAlertModal } from '#/renderer/src/store/slices/modalsSlice';

/**
 * Blocking alert dialog with a single OK button for errors and messages.
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

  if (!alertModal) return null;

  if (alertModal.icon === 'warning') {
    return (
      <Modal onClose={handleClose} labelledBy="alert-modal-title" title={alertModal.title}>
        <div className="flex items-start gap-3">
          <FaIcon icon={faCircleExclamation} className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <p className="m-0 text-[14px] text-text">{alertModal.message}</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={handleClose} labelledBy="alert-modal-title" title={alertModal.title}>
      <p className="text-[14px] text-muted">{alertModal.message}</p>
    </Modal>
  );
}
