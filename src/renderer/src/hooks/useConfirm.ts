import { useCallback } from 'react';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import {
  showConfirm,
  type ConfirmOptions,
  type ConfirmResult
} from '#/renderer/src/ui/modals/dialogHelpers';

/**
 * Callback that opens a confirmation modal and resolves with the user's choice.
 */
export interface ConfirmFn {
  /**
   * Opens a confirmation modal with a required checkbox and returns checkbox state.
   *
   * @param options - Dialog options including checkboxLabel.
   */
  (options: ConfirmOptions & { checkboxLabel: string }): Promise<ConfirmResult>;

  /**
   * Opens a confirmation modal and returns whether the user confirmed.
   *
   * @param options - Dialog title, message, and button labels.
   */
  (options: ConfirmOptions): Promise<boolean>;
}

/**
 * Returns a function that opens a custom confirmation modal and resolves with the user's choice.
 */
export function useConfirm(): ConfirmFn {
  const dispatch = useAppDispatch();

  /**
   * Opens a confirmation modal via Redux and returns whether the user confirmed.
   */
  const confirm = useCallback(
    (options: ConfirmOptions) => showConfirm(dispatch, options),
    [dispatch]
  );

  return confirm as ConfirmFn;
}
