import { useCallback, type JSX } from 'react';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectConfirmModal } from '#/renderer/src/store/slices/modalsSlice';
import { Button } from '#/renderer/src/components/Button';
import { Modal } from '#/renderer/src/components/Modal';
import { resolveConfirm } from '#/renderer/src/ui/modals/dialogHelpers';

/**
 * Confirmation dialog with cancel and confirm actions for destructive or irreversible operations.
 */
export function ConfirmModal(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const confirmModal = useAppSelector(selectConfirmModal);

  /**
   * Dismisses the dialog without confirming the pending action.
   */
  const handleCancel = useCallback((): void => {
    resolveConfirm(dispatch, false);
  }, [dispatch]);

  /**
   * Confirms the pending action and resolves the showConfirm promise.
   */
  const handleConfirm = useCallback((): void => {
    resolveConfirm(dispatch, true);
  }, [dispatch]);

  if (!confirmModal) return null;

  return (
    <Modal onClose={handleCancel} labelledBy="confirm-modal-title" title={confirmModal.title}>
      <p className="mb-4 text-[14px] text-muted">{confirmModal.message}</p>
      <div className="flex justify-end gap-2">
        <Button
          variant={confirmModal.variant === 'danger' ? 'primaryDanger' : 'primary'}
          onClick={handleConfirm}
        >
          {confirmModal.confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
