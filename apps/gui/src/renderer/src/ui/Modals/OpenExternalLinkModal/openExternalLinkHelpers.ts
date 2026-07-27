import type { AppDispatch } from '#/renderer/src/store/redux';
import {
  setOpenExternalLinkModal,
  type OpenExternalLinkModalState
} from '#/renderer/src/store/slices/modalsSlice';

/**
 * Result from the open-external-link confirmation dialog.
 */
export interface OpenExternalLinkResult {
  /** Whether the user confirmed opening the link. */
  confirmed: boolean;
  /** When true, trust this URL's domain for future opens. */
  trustDomain: boolean;
  /** When true, skip confirmation for every domain going forward. */
  allowAll: boolean;
}

let openExternalLinkResolver: ((result: OpenExternalLinkResult) => void) | null = null;

/**
 * Opens the external-link confirmation modal and resolves with the user's choices.
 *
 * @param dispatch - Redux dispatch for modal state.
 * @param url - Absolute URL shown in the dialog and opened on confirm.
 */
export function showOpenExternalLinkConfirm(
  dispatch: AppDispatch,
  url: string
): Promise<OpenExternalLinkResult> {
  return new Promise((resolve) => {
    openExternalLinkResolver = resolve;
    const state: OpenExternalLinkModalState = { url };
    dispatch(setOpenExternalLinkModal(state));
  });
}

/**
 * Resolves a pending {@link showOpenExternalLinkConfirm} promise and clears modal state.
 *
 * @param dispatch - Redux dispatch for modal state.
 * @param result - User choices from the dialog.
 */
export function resolveOpenExternalLinkConfirm(
  dispatch: AppDispatch,
  result: OpenExternalLinkResult
): void {
  dispatch(setOpenExternalLinkModal(null));
  openExternalLinkResolver?.(result);
  openExternalLinkResolver = null;
}
