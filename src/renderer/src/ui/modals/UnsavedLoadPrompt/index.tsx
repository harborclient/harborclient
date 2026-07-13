import { useCallback, type JSX } from 'react';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectPendingLoadDocument,
  selectPendingLoadRequest,
  setPendingLoadDocument,
  setPendingLoadRequest
} from '#/renderer/src/store/slices/modalsSlice';
import { requestLoadDocument } from '#/renderer/src/store/thunks/documents';
import { requestLoadRequest } from '#/renderer/src/store/thunks/requests';
import { Button } from '@harborclient/sdk/components';
import { Modal, ModalFooter } from '@harborclient/sdk/components';

/**
 * Confirms opening a request or markdown document when settings tabs have unsaved edits.
 */
export function UnsavedLoadPrompt(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const pendingLoadRequest = useAppSelector(selectPendingLoadRequest);
  const pendingLoadDocument = useAppSelector(selectPendingLoadDocument);

  /**
   * Dismisses the prompt and keeps the current editor or settings state.
   */
  const handleCancel = useCallback((): void => {
    dispatch(setPendingLoadRequest(null));
    dispatch(setPendingLoadDocument(null));
  }, [dispatch]);

  /**
   * Discards unsaved settings edits and loads the pending request.
   */
  const handleConfirmRequest = useCallback((): void => {
    if (!pendingLoadRequest) return;
    const { req } = pendingLoadRequest;
    dispatch(setPendingLoadRequest(null));
    void dispatch(
      requestLoadRequest({
        req,
        skipSettingsCheck: true
      })
    );
  }, [dispatch, pendingLoadRequest]);

  /**
   * Discards unsaved settings edits and loads the pending markdown document.
   */
  const handleConfirmDocument = useCallback((): void => {
    if (!pendingLoadDocument) return;
    const { doc } = pendingLoadDocument;
    dispatch(setPendingLoadDocument(null));
    void dispatch(
      requestLoadDocument({
        doc,
        skipSettingsCheck: true
      })
    );
  }, [dispatch, pendingLoadDocument]);

  if (pendingLoadRequest) {
    const { req } = pendingLoadRequest;

    return (
      <Modal onClose={handleCancel} labelledBy="unsaved-load-prompt-title" title="Unsaved changes">
        <p className="mb-4 text-[14px] text-muted">
          Settings have unsaved changes. Open request &ldquo;{req.name}&rdquo; without saving?
        </p>
        <ModalFooter>
          <Button onClick={handleConfirmRequest}>Open without saving</Button>
        </ModalFooter>
      </Modal>
    );
  }

  if (!pendingLoadDocument) return null;

  const { doc } = pendingLoadDocument;

  return (
    <Modal onClose={handleCancel} labelledBy="unsaved-load-prompt-title" title="Unsaved changes">
      <p className="mb-4 text-[14px] text-muted">
        Settings have unsaved changes. Open document &ldquo;{doc.name}&rdquo; without saving?
      </p>
      <ModalFooter>
        <Button onClick={handleConfirmDocument}>Open without saving</Button>
      </ModalFooter>
    </Modal>
  );
}
