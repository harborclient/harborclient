import { useCallback, useEffect, type JSX } from 'react';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { closeUpdateModal, selectUpdateModal } from '#/renderer/src/store/slices/modalsSlice';
import { checkForUpdates } from '#/renderer/src/store/thunks';
import { Modal } from '#/renderer/src/components/Modal';

/**
 * Spinner shown while the update check request is in flight.
 */
function UpdateCheckSpinner(): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-3 py-2" role="status" aria-live="polite">
      <svg
        className="h-8 w-8 animate-spin text-accent"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <p className="m-0 text-[14px] text-muted">Checking for updates...</p>
    </div>
  );
}

/**
 * Dialog that checks GitHub for a newer release and reports the result.
 */
export function UpdateModal(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const update = useAppSelector(selectUpdateModal);

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
        <p className="m-0 text-[14px] text-danger" role="alert">
          {update.error}
        </p>
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
