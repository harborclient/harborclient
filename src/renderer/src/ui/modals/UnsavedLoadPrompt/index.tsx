import { useCallback, type JSX } from 'react';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectPendingLoadRequest,
  setPendingLoadRequest
} from '#/renderer/src/store/slices/modalsSlice';
import { requestLoadRequest } from '#/renderer/src/store/thunks/requests';
import { primaryButton, secondaryButton } from '#/renderer/src/ui/shared/classes';
import { Modal } from '#/renderer/src/ui/shared/Modal';

/**
 * Confirms opening a request when settings or request tabs have unsaved edits.
 */
export function UnsavedLoadPrompt(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const pendingLoadRequest = useAppSelector(selectPendingLoadRequest);

  /**
   * Dismisses the prompt and keeps the current editor or settings state.
   */
  const handleCancel = useCallback((): void => {
    dispatch(setPendingLoadRequest(null));
  }, [dispatch]);

  /**
   * Discards unsaved edits and loads the pending request.
   */
  const handleConfirm = useCallback((): void => {
    if (!pendingLoadRequest) return;
    const { req, reason } = pendingLoadRequest;
    dispatch(setPendingLoadRequest(null));
    void dispatch(
      requestLoadRequest({
        req,
        skipSettingsCheck: true,
        forceReload: reason === 'dirty-tab'
      })
    );
  }, [dispatch, pendingLoadRequest]);

  if (!pendingLoadRequest) return null;

  const { req, reason } = pendingLoadRequest;
  const isDirtyTab = reason === 'dirty-tab';

  return (
    <Modal onClose={handleCancel}>
      <h2 className="m-0 mb-1 text-[13px] font-semibold text-text">Unsaved changes</h2>
      <p className="mb-4 text-[12px] text-muted">
        {isDirtyTab ? (
          <>&ldquo;{req.name}&rdquo; has unsaved changes. Reload without saving?</>
        ) : (
          <>Settings have unsaved changes. Open request without saving?</>
        )}
      </p>
      <div className="flex justify-end gap-2">
        <button className={secondaryButton} onClick={handleCancel}>
          Cancel
        </button>
        <button className={primaryButton} onClick={handleConfirm}>
          {isDirtyTab ? 'Reload without saving' : 'Open without saving'}
        </button>
      </div>
    </Modal>
  );
}
