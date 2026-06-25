import { useCallback, type JSX } from 'react';
import { Button } from '#/renderer/src/components/Button';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { Modal } from '#/renderer/src/components/Modal';
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
      <Modal onClose={handleClose} labelledBy="alert-modal-title">
        <div className="flex items-start gap-3">
          <FaIcon
            icon={faCircleExclamation}
            className="mt-0.5 h-5 w-5 shrink-0 text-danger"
            title="Warning"
          />
          <div className="min-w-0 flex-1">
            <h2 id="alert-modal-title" className="m-0 mb-1 text-[14px] font-semibold text-text">
              {alertModal.title}
            </h2>
            <p className="m-0 mb-4 text-[14px] text-text">{alertModal.message}</p>
            <div className="flex justify-end gap-2">
              <Button onClick={handleClose}>OK</Button>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={handleClose} labelledBy="alert-modal-title">
      <h2 id="alert-modal-title" className="m-0 mb-1 text-[14px] font-semibold text-text">
        {alertModal.title}
      </h2>
      <p className="mb-4 text-[14px] text-muted">{alertModal.message}</p>
      <div className="flex justify-end gap-2">
        <Button onClick={handleClose}>OK</Button>
      </div>
    </Modal>
  );
}
