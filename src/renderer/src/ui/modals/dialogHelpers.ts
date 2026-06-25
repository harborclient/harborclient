import type { AppDispatch } from '#/renderer/src/store/redux';
import { setAlertModal, setConfirmModal } from '#/renderer/src/store/slices/modalsSlice';

/**
 * Options for a custom confirmation dialog.
 */
export interface ConfirmOptions {
  /** Dialog heading shown above the message. */
  title: string;
  /** Body text explaining what the user is confirming. */
  message: string;
  /** Label for the confirm button (defaults to "Confirm"). */
  confirmLabel?: string;
  /** Label for the cancel button (defaults to "Cancel"). */
  cancelLabel?: string;
  /** When "danger", the confirm button uses destructive styling. */
  variant?: 'default' | 'danger';
}

/**
 * Options for {@link showAlert}.
 */
export interface AlertOptions {
  /** When set, shows a decorative warning icon beside the dialog content. */
  icon?: 'warning';
}

let confirmResolver: ((confirmed: boolean) => void) | null = null;

const IPC_ERROR_PREFIX = /^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/i;

/**
 * Formats an unknown thrown value as a user-facing error string.
 *
 * @param err - Caught error from an async operation.
 * @param fallback - Message when `err` is not an `Error` instance.
 * @returns A string suitable for display in a modal or inline error.
 */
export function formatErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/**
 * Formats IPC invoke failures as a user-facing message without Electron's wrapper prefix.
 *
 * @param err - Caught error from a renderer IPC call.
 * @param fallback - Message when the error cannot be parsed.
 * @returns Trimmed user-facing message text.
 */
export function formatIpcErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) {
    return fallback;
  }

  const message = err.message.replace(IPC_ERROR_PREFIX, '').trim();
  return message.length > 0 ? message : fallback;
}

/**
 * Opens a blocking alert modal with a single OK button.
 *
 * @param dispatch - Redux dispatch for modal state.
 * @param message - Body text shown in the dialog.
 * @param title - Dialog heading (defaults to "Error").
 * @param options - Optional presentation overrides such as a warning icon.
 */
export function showAlert(
  dispatch: AppDispatch,
  message: string,
  title = 'Error',
  options?: AlertOptions
): void {
  dispatch(setAlertModal({ title, message, icon: options?.icon }));
}

/**
 * Opens a confirmation modal and resolves when the user chooses an action.
 *
 * @param dispatch - Redux dispatch for modal state.
 * @param options - Title, message, and button labels for the dialog.
 * @returns Resolves to true when confirmed, false when cancelled or dismissed.
 */
export function showConfirm(dispatch: AppDispatch, options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    confirmResolver = resolve;
    dispatch(
      setConfirmModal({
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? 'Confirm',
        cancelLabel: options.cancelLabel ?? 'Cancel',
        variant: options.variant ?? 'default'
      })
    );
  });
}

/**
 * Resolves a pending `showConfirm` promise and clears confirm modal state.
 *
 * @param dispatch - Redux dispatch for modal state.
 * @param confirmed - Whether the user confirmed the action.
 */
export function resolveConfirm(dispatch: AppDispatch, confirmed: boolean): void {
  dispatch(setConfirmModal(null));
  confirmResolver?.(confirmed);
  confirmResolver = null;
}
