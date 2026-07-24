import { Button, FaIcon, Modal, ModalFooter } from '@harborclient/sdk/components';
import { useCallback, type JSX } from 'react';

import { faCircleExclamation } from '#/renderer/src/fontawesome';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectAlertModal,
  setAlertModal,
  type AlertModalAction
} from '#/renderer/src/store/slices/modalsSlice';
import { selectActiveTerminalId } from '#/renderer/src/store/slices/terminalsSlice';
import {
  openCollectionGitSettings,
  openGitRepoTerminal
} from '#/renderer/src/ui/Modals/dialogHelpers';

/**
 * Blocking alert dialog with OK and optional remediation action buttons.
 */
export function AlertModal(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const alertModal = useAppSelector(selectAlertModal);
  const activeTerminalId = useAppSelector(selectActiveTerminalId);

  /**
   * Dismisses the alert dialog.
   */
  const handleClose = useCallback((): void => {
    dispatch(setAlertModal(null));
  }, [dispatch]);

  /**
   * Runs one remediation action after closing the dialog.
   *
   * @param action - Alert footer action to execute.
   */
  const handleAction = useCallback(
    (action: AlertModalAction): void => {
      dispatch(setAlertModal(null));

      if (action.kind === 'openCollectionGitSettings') {
        openCollectionGitSettings(dispatch, action.collectionId);
        return;
      }

      if (action.kind === 'openGitRepoTerminal') {
        void openGitRepoTerminal(dispatch, action.connectionId, activeTerminalId);
      }
    },
    [activeTerminalId, dispatch]
  );

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

  const actions = alertModal.actions ?? [];

  return (
    <Modal
      className="w-150"
      onClose={handleClose}
      labelledBy="alert-modal-title"
      title={alertModal.title}
    >
      {body}
      <ModalFooter spaced>
        {actions.map((action) => (
          <Button
            key={`${action.kind}-${action.label}`}
            type="button"
            onClick={() => handleAction(action)}
          >
            {action.label}
          </Button>
        ))}
        <Button type="button" variant="secondary" onClick={handleClose}>
          OK
        </Button>
      </ModalFooter>
    </Modal>
  );
}
