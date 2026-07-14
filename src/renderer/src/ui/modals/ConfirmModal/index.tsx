import { Button, Checkbox, Modal, ModalFooter } from '@harborclient/sdk/components';
import { useCallback, useState, type JSX } from 'react';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectConfirmModal,
  type ConfirmModalState
} from '#/renderer/src/store/slices/modalsSlice';
import type { AppDispatch } from '#/renderer/src/store/redux';

import { resolveConfirm } from '#/renderer/src/ui/modals/dialogHelpers';

const CONFIRM_MODAL_CHECKBOX_ID = 'confirm-modal-checkbox';

interface ConfirmModalContentProps {
  /** Active confirmation dialog state. */
  confirmModal: ConfirmModalState;
  /** Redux dispatch for modal resolution. */
  dispatch: AppDispatch;
}

/**
 * Renders one confirmation dialog instance; remounting resets optional checkbox state.
 */
function ConfirmModalContent({ confirmModal, dispatch }: ConfirmModalContentProps): JSX.Element {
  const [checkboxChecked, setCheckboxChecked] = useState(false);
  const [reconfirming, setReconfirming] = useState(false);

  /**
   * Dismisses the dialog without confirming the pending action.
   */
  const handleCancel = useCallback((): void => {
    resolveConfirm(dispatch, false, checkboxChecked);
  }, [checkboxChecked, dispatch]);

  /**
   * Confirms the pending action and resolves the showConfirm promise.
   */
  const handleConfirm = useCallback((): void => {
    resolveConfirm(dispatch, true, checkboxChecked);
  }, [checkboxChecked, dispatch]);

  /**
   * Reveals the "Are you sure?" link on the first click when reconfirm is enabled.
   */
  const handlePrimaryClick = useCallback((): void => {
    if (confirmModal.reconfirm && !reconfirming) {
      setReconfirming(true);
      return;
    }
    handleConfirm();
  }, [confirmModal.reconfirm, handleConfirm, reconfirming]);

  return (
    <Modal onClose={handleCancel} labelledBy="confirm-modal-title" title={confirmModal.title}>
      <p className="mb-4 text-muted">{confirmModal.message}</p>
      {confirmModal.checkboxLabel ? (
        <div className="mb-4 flex items-center gap-2">
          <Checkbox
            id={CONFIRM_MODAL_CHECKBOX_ID}
            checked={checkboxChecked}
            onChange={(event) => setCheckboxChecked(event.target.checked)}
          />
          <label htmlFor={CONFIRM_MODAL_CHECKBOX_ID} className="text-muted">
            {confirmModal.checkboxLabel}
          </label>
        </div>
      ) : null}
      <ModalFooter>
        {confirmModal.reconfirm && reconfirming ? (
          <button
            type="button"
            onClick={handleConfirm}
            className="mr-auto self-center bg-transparent p-0 text-[15px] text-white underline-offset-2 hover:underline focus-visible:underline"
          >
            Are you sure?
          </button>
        ) : null}
        <Button
          variant={confirmModal.variant === 'danger' ? 'primaryDanger' : 'primary'}
          onClick={handlePrimaryClick}
        >
          {confirmModal.confirmLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

/**
 * Confirmation dialog with cancel and confirm actions for destructive or irreversible operations.
 */
export function ConfirmModal(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const confirmModal = useAppSelector(selectConfirmModal);

  if (!confirmModal) return null;

  const contentKey = `${confirmModal.title}\0${confirmModal.message}\0${confirmModal.confirmLabel}\0${confirmModal.checkboxLabel ?? ''}\0${confirmModal.reconfirm ? '1' : '0'}`;

  return <ConfirmModalContent key={contentKey} confirmModal={confirmModal} dispatch={dispatch} />;
}
