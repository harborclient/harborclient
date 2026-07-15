import { useCallback, useState } from 'react';

import {
  canCloseTypedDeleteConfirm,
  runTypedDeleteConfirm
} from '#/renderer/src/hooks/useTypedDeleteConfirm.logic';

interface Options<T> {
  /**
   * Async delete handler for the selected entity.
   */
  onDelete: (target: T) => Promise<void>;

  /**
   * Optional callback invoked after a successful delete.
   */
  onSuccess?: () => void;

  /**
   * Optional toast message shown after a successful delete.
   */
  successMessage?: string;
}

interface TypedDeleteConfirmState<T> {
  /**
   * Entity currently selected for deletion, or null when the modal is closed.
   */
  target: T | null;

  /**
   * Whether a delete request is in flight.
   */
  busy: boolean;

  /**
   * Inline error message from the last failed delete attempt.
   */
  error: string | null;

  /**
   * Opens the delete confirmation modal for the given entity.
   */
  open: (next: T) => void;

  /**
   * Closes the delete confirmation modal when not busy.
   */
  close: () => void;

  /**
   * Runs the delete handler after the operator typed the confirmation word.
   */
  confirm: () => Promise<void>;
}

/**
 * Manages open/close, busy, and error state for typed delete confirmation modals.
 *
 * @param options - Delete handler and optional success side effects.
 * @returns State and actions for wiring `DeleteConfirmModal`.
 */
export function useTypedDeleteConfirm<T>({
  onDelete,
  onSuccess,
  successMessage
}: Options<T>): TypedDeleteConfirmState<T> {
  const [target, setTarget] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Opens the delete confirmation modal for the given entity.
   */
  const open = useCallback((next: T) => {
    setError(null);
    setTarget(next);
  }, []);

  /**
   * Closes the delete confirmation modal when not busy.
   */
  const close = useCallback(() => {
    if (!canCloseTypedDeleteConfirm(busy)) {
      return;
    }

    setTarget(null);
    setError(null);
  }, [busy]);

  /**
   * Runs the delete handler after the operator typed the confirmation word.
   */
  const confirm = useCallback(async () => {
    setBusy(true);
    setError(null);

    const result = await runTypedDeleteConfirm({
      target,
      onDelete,
      onSuccess,
      successMessage
    });

    if (result.status === 'success') {
      setTarget(null);
    } else if (result.status === 'error') {
      setError(result.message);
    }

    setBusy(false);
  }, [target, onDelete, onSuccess, successMessage]);

  return { target, busy, error, open, close, confirm };
}
