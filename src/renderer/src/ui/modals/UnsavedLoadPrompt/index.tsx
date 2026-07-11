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
 * Confirms opening a request or markdown document when settings or editor tabs have unsaved edits.
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
   * Discards unsaved edits and loads the pending request.
   */
  const handleConfirmRequest = useCallback((): void => {
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

  /**
   * Discards unsaved edits and loads the pending markdown document.
   */
  const handleConfirmDocument = useCallback((): void => {
    if (!pendingLoadDocument) return;
    const { doc, reason } = pendingLoadDocument;
    dispatch(setPendingLoadDocument(null));
    void dispatch(
      requestLoadDocument({
        doc,
        skipSettingsCheck: true,
        forceReload: reason === 'dirty-tab'
      })
    );
  }, [dispatch, pendingLoadDocument]);

  if (pendingLoadRequest) {
    const { req, reason } = pendingLoadRequest;
    const isDirtyTab = reason === 'dirty-tab';

    return (
      <Modal onClose={handleCancel} labelledBy="unsaved-load-prompt-title" title="Unsaved changes">
        <p className="mb-4 text-[14px] text-muted">
          {isDirtyTab ? (
            <>&ldquo;{req.name}&rdquo; has unsaved changes. Reload without saving?</>
          ) : (
            <>Settings have unsaved changes. Open request without saving?</>
          )}
        </p>
        <ModalFooter>
          <Button onClick={handleConfirmRequest}>
            {isDirtyTab ? 'Reload without saving' : 'Open without saving'}
          </Button>
        </ModalFooter>
      </Modal>
    );
  }

  if (!pendingLoadDocument) return null;

  const { doc, reason } = pendingLoadDocument;
  const isDirtyTab = reason === 'dirty-tab';

  return (
    <Modal onClose={handleCancel} labelledBy="unsaved-load-prompt-title" title="Unsaved changes">
      <p className="mb-4 text-[14px] text-muted">
        {isDirtyTab ? (
          <>&ldquo;{doc.name}&rdquo; has unsaved changes. Reload without saving?</>
        ) : (
          <>Settings have unsaved changes. Open document without saving?</>
        )}
      </p>
      <ModalFooter>
        <Button onClick={handleConfirmDocument}>
          {isDirtyTab ? 'Reload without saving' : 'Open without saving'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
