import {
  Button,
  FieldError,
  FormGroup,
  Input,
  Modal,
  ModalFormLayout
} from '@harborclient/sdk/components';
import { useId, useState, type JSX, type ReactNode } from 'react';

import { isDeleteConfirmationReady } from '#/renderer/src/ui/shared/deleteConfirmModal.logic';

interface Props {
  /**
   * Modal title shown in the dialog header.
   */
  title: string;

  /**
   * Body copy explaining what will be permanently deleted.
   */
  description: ReactNode;

  /**
   * Exact text the operator must type before the delete button enables.
   */
  confirmText?: string;

  /**
   * True while the delete request is in flight.
   */
  busy: boolean;

  /**
   * Inline IPC or validation error from the parent delete handler.
   */
  error: string | null;

  /**
   * Invoked when the operator confirms after typing the required text.
   */
  onConfirm: () => void;

  /**
   * Closes the modal without deleting.
   */
  onClose: () => void;
}

/**
 * Blocking modal that requires typing a confirmation word before a destructive action.
 */
export function DeleteConfirmModal({
  title,
  description,
  confirmText = 'DELETE',
  busy,
  error,
  onConfirm,
  onClose
}: Props): JSX.Element {
  const [value, setValue] = useState('');
  const titleId = useId();
  const inputId = useId();
  const canConfirm = isDeleteConfirmationReady(busy, value, confirmText);

  return (
    <Modal
      className="w-[480px]"
      labelledBy={titleId}
      onClose={onClose}
      title={title}
      description={description}
      closeDisabled={busy}
      disableEscape={busy}
    >
      <ModalFormLayout
        error={error ? <FieldError spacing="modal">{error}</FieldError> : null}
        actions={
          <Button type="button" variant="primaryDanger" disabled={!canConfirm} onClick={onConfirm}>
            {busy ? 'Deleting…' : 'Delete'}
          </Button>
        }
      >
        <FormGroup label={`Type ${confirmText} to confirm`} htmlFor={inputId}>
          <Input
            id={inputId}
            type="text"
            variant="surface"
            value={value}
            disabled={busy}
            autoComplete="off"
            onChange={(event) => setValue(event.target.value)}
          />
        </FormGroup>
      </ModalFormLayout>
    </Modal>
  );
}
