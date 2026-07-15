import { Modal, FieldError } from '@harborclient/sdk/components';
import { useCallback, useEffect, type JSX } from 'react';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { closeUpdateModal, selectUpdateModal } from '#/renderer/src/store/slices/modalsSlice';
import { checkForUpdates } from '#/renderer/src/store/thunks';
import { UpdateCheckSpinner } from './UpdateCheckSpinner';

/**
 * Dialog that checks GitHub for a newer release and reports the result.
 */
export function UpdateModal(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const update = useAppSelector(selectUpdateModal);

  /**
   * Closes the update check dialog.
   */
  const handleClose = useCallback((): void => {
    dispatch(closeUpdateModal());
  }, [dispatch]);

  /**
   * Starts the update check when the dialog opens.
   */
  useEffect(() => {
    if (!update.open) return;
    void dispatch(checkForUpdates());
  }, [update.open, dispatch]);

  if (!update.open) return null;

  return (
    <Modal
      onClose={handleClose}
      className="w-96"
      labelledBy="update-modal-title"
      title="Check for Updates"
    >
      {update.loading && <UpdateCheckSpinner />}

      {!update.loading && update.error && (
        <FieldError spacing="field" className="m-0" roleAlert>
          {update.error}
        </FieldError>
      )}

      {!update.loading && !update.error && update.result?.updateAvailable && (
        <div className="space-y-3 text-[14px] text-text">
          <p className="m-0">
            A new version is available: v{update.result.latestVersion} (you have v
            {update.result.currentVersion}).
          </p>
          <a
            href={update.result.releaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-accent hover:underline"
          >
            View releases on GitHub
          </a>
        </div>
      )}

      {!update.loading && !update.error && update.result && !update.result.updateAvailable && (
        <p className="m-0 text-[14px] text-text">
          You&apos;re on the latest version (v{update.result.currentVersion}).
        </p>
      )}
    </Modal>
  );
}
