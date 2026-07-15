import type { AppDispatch } from '#/renderer/src/store/redux';
import { stripIpcInvokeErrorPrefix } from '#/shared/gitHttpErrors';
import {
  setAlertModal,
  setConfirmModal,
  type AlertModalAction
} from '#/renderer/src/store/slices/modalsSlice';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';

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
  /** When set, renders a checkbox below the message with this label. */
  checkboxLabel?: string;
  /** When true, the confirm button requires a second "Are you sure?" click. */
  reconfirm?: boolean;
}

/**
 * Result from a confirmation dialog that includes an optional checkbox.
 */
export interface ConfirmResult {
  /** Whether the user confirmed the action. */
  confirmed: boolean;
  /** Whether the optional checkbox was checked when the dialog closed. */
  checkboxChecked: boolean;
}

/**
 * Options for {@link showAlert}.
 */
export interface AlertOptions {
  /** When set, shows a decorative warning icon beside the dialog content. */
  icon?: 'warning';
  /** Optional remediation button shown beside OK. */
  action?: AlertModalAction;
}

let confirmResolver: ((confirmed: boolean, checkboxChecked: boolean) => void) | null = null;
let confirmHasCheckbox = false;

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

  const message = stripIpcInvokeErrorPrefix(err.message);
  return message.length > 0 ? message : fallback;
}

/**
 * Opens a blocking alert modal with a single OK button.
 *
 * @param dispatch - Redux dispatch for modal state.
 * @param message - Body text shown in the dialog.
 * @param title - Dialog heading (defaults to "Error").
 * @param options - Optional presentation overrides such as a warning icon or action.
 */
export function showAlert(
  dispatch: AppDispatch,
  message: string,
  title = 'Error',
  options?: AlertOptions
): void {
  dispatch(setAlertModal({ title, message, icon: options?.icon, action: options?.action }));
}

/**
 * Opens collection settings focused on the Git tab.
 *
 * @param dispatch - Redux dispatch for tab navigation.
 * @param collectionId - Collection whose Git settings should open.
 */
export function openCollectionGitSettings(dispatch: AppDispatch, collectionId: number): void {
  dispatch(openPageTab({ type: 'collection', id: collectionId, focusSection: 'git' }));
}

/**
 * Opens a confirmation modal with an optional checkbox and resolves when the user chooses.
 *
 * @param dispatch - Redux dispatch for modal state.
 * @param options - Title, message, button labels, and optional checkbox label.
 * @returns Resolves to confirmation result including checkbox state when a checkbox is shown.
 */
export function showConfirm(
  dispatch: AppDispatch,
  options: ConfirmOptions & { checkboxLabel: string }
): Promise<ConfirmResult>;

/**
 * Opens a confirmation modal and resolves when the user chooses an action.
 *
 * @param dispatch - Redux dispatch for modal state.
 * @param options - Title, message, and button labels for the dialog.
 * @returns Resolves to true when confirmed, false when cancelled or dismissed.
 */
export function showConfirm(dispatch: AppDispatch, options: ConfirmOptions): Promise<boolean>;

/**
 * Opens a confirmation modal and resolves when the user chooses an action.
 *
 * @param dispatch - Redux dispatch for modal state.
 * @param options - Title, message, and button labels for the dialog.
 * @returns Resolves to a boolean or {@link ConfirmResult} when a checkbox is shown.
 */
export function showConfirm(
  dispatch: AppDispatch,
  options: ConfirmOptions
): Promise<boolean | ConfirmResult> {
  return new Promise((resolve) => {
    confirmHasCheckbox = options.checkboxLabel !== undefined;
    confirmResolver = (confirmed, checkboxChecked) => {
      if (confirmHasCheckbox) {
        resolve({ confirmed, checkboxChecked });
      } else {
        resolve(confirmed);
      }
    };
    dispatch(
      setConfirmModal({
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? 'Confirm',
        cancelLabel: options.cancelLabel ?? 'Cancel',
        variant: options.variant ?? 'default',
        checkboxLabel: options.checkboxLabel,
        reconfirm: options.reconfirm
      })
    );
  });
}

/**
 * Resolves a pending `showConfirm` promise and clears confirm modal state.
 *
 * @param dispatch - Redux dispatch for modal state.
 * @param confirmed - Whether the user confirmed the action.
 * @param checkboxChecked - Whether the optional checkbox was checked when the dialog closed.
 */
export function resolveConfirm(
  dispatch: AppDispatch,
  confirmed: boolean,
  checkboxChecked = false
): void {
  dispatch(setConfirmModal(null));
  confirmResolver?.(confirmed, checkboxChecked);
  confirmResolver = null;
  confirmHasCheckbox = false;
}
