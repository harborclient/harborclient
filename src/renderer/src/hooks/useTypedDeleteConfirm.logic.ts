import toast from 'react-hot-toast';

/**
 * Outcome of attempting a typed delete confirmation.
 */
export type TypedDeleteConfirmResult =
  | { status: 'cancelled' }
  | { status: 'success' }
  | { status: 'error'; message: string };

/**
 * Parameters for running a typed delete confirmation action.
 */
export interface RunTypedDeleteConfirmParams<T> {
  /**
   * Entity selected for deletion, or null when nothing is open.
   */
  target: T | null;

  /**
   * Async delete handler supplied by the caller (typically an IPC call).
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

/**
 * Returns whether the typed delete modal can be dismissed.
 *
 * @param busy - True while a delete request is in flight.
 * @returns True when close should be allowed.
 */
export function canCloseTypedDeleteConfirm(busy: boolean): boolean {
  return !busy;
}

/**
 * Runs the typed delete confirmation flow and returns a result the hook can apply.
 *
 * @param params - Delete target and caller-supplied handlers.
 * @returns Structured outcome for success, cancellation, or failure.
 */
export async function runTypedDeleteConfirm<T>(
  params: RunTypedDeleteConfirmParams<T>
): Promise<TypedDeleteConfirmResult> {
  const { target, onDelete, onSuccess, successMessage } = params;

  if (!target) {
    return { status: 'cancelled' };
  }

  try {
    await onDelete(target);
    onSuccess?.();
    if (successMessage) {
      toast.success(successMessage);
    }
    return { status: 'success' };
  } catch (err: unknown) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : String(err)
    };
  }
}
