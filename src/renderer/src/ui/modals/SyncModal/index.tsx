import { useCallback, useMemo, type JSX } from 'react';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  closeSyncModal,
  selectSyncModal,
  type SyncProviderProgress
} from '#/renderer/src/store/slices/modalsSlice';
import { Modal } from '#/renderer/src/components/Modal';

/**
 * Returns a human-readable label for a provider kind.
 *
 * @param kind - Database connection or team hub.
 * @returns Display label for the provider type.
 */
function providerKindLabel(kind: SyncProviderProgress['kind']): string {
  return kind === 'team-hub' ? 'Team Hub' : 'Database';
}

/**
 * Returns a short status label paired with color for accessibility.
 *
 * @param provider - Provider progress row from the sync modal state.
 * @returns Status text shown beside each provider name.
 */
function providerStatusLabel(provider: SyncProviderProgress): string {
  switch (provider.status) {
    case 'pending':
      return 'Pending';
    case 'syncing':
      return 'Syncing…';
    case 'success':
      return 'Synced';
    case 'error':
      return provider.error ?? 'Failed';
  }
}

/**
 * Modal that syncs all providers with a determinate progress bar and per-provider summary.
 */
export function SyncModal(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const syncModal = useAppSelector(selectSyncModal);

  const handleClose = useCallback((): void => {
    if (syncModal.running) return;
    dispatch(closeSyncModal());
  }, [dispatch, syncModal.running]);

  /**
   * Derives the provider currently being synced for the status line.
   */
  const currentProvider = useMemo(
    (): SyncProviderProgress | undefined =>
      syncModal.providers.find((provider) => provider.status === 'syncing'),
    [syncModal.providers]
  );

  /**
   * Computes progress percentage for the determinate progress bar.
   */
  const progressPercent = useMemo((): number => {
    if (syncModal.total === 0) return 0;
    return Math.round((syncModal.completed / syncModal.total) * 100);
  }, [syncModal.completed, syncModal.total]);

  if (!syncModal.open) return null;

  return (
    <Modal
      onClose={handleClose}
      className="w-[28rem]"
      labelledBy="sync-modal-title"
      title="Sync"
      disableEscape={syncModal.running}
      closeDisabled={syncModal.running}
    >
      {syncModal.running && (
        <div className="space-y-3">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
            aria-label="Sync progress"
            className="h-2 overflow-hidden rounded-full bg-separator"
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="m-0 text-[14px] text-muted" role="status" aria-live="polite">
            {syncModal.total === 0
              ? 'No providers configured.'
              : currentProvider
                ? `Syncing ${syncModal.completed + 1} of ${syncModal.total}: ${currentProvider.name}`
                : `Refreshing data… (${syncModal.completed} of ${syncModal.total} providers done)`}
          </p>
        </div>
      )}

      {!syncModal.running &&
        (syncModal.providers.length === 0 ? (
          <p className="m-0 text-[14px] text-muted">No providers configured.</p>
        ) : (
          <ul className="m-0 max-h-64 list-none space-y-2 overflow-y-auto p-0">
            {syncModal.providers.map((provider) => (
              <li
                key={provider.id}
                className="rounded border border-separator px-3 py-2 text-[14px]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="m-0 font-medium text-text">{provider.name}</p>
                    <p className="m-0 text-[14px] text-muted">{providerKindLabel(provider.kind)}</p>
                  </div>
                  <span
                    className={
                      provider.status === 'error'
                        ? 'text-danger'
                        : provider.status === 'success'
                          ? 'text-text'
                          : 'text-muted'
                    }
                  >
                    {providerStatusLabel(provider)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ))}
    </Modal>
  );
}
