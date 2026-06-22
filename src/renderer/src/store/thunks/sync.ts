import { createAsyncThunk } from '@reduxjs/toolkit';
import type { ThunkApiConfig } from '#/renderer/src/store/redux';
import {
  finishSync,
  incrementSyncCompleted,
  setSyncProviderStatus,
  setSyncProviders,
  type SyncProviderProgress
} from '#/renderer/src/store/slices/modalsSlice';
import {
  refreshCollectionContents,
  refreshCollections
} from '#/renderer/src/store/thunks/collections';
import { refreshEnvironments } from '#/renderer/src/store/thunks/environments';
import { formatErrorMessage } from '#/renderer/src/ui/modals/dialogHelpers';

/**
 * Syncs every configured provider sequentially, then refreshes collections,
 * environments, and any cached collection contents in the renderer.
 */
export const runSync = createAsyncThunk<void, void, ThunkApiConfig>(
  'sync/run',
  async (_, { dispatch, getState }) => {
    const [connections, hubs] = await Promise.all([
      window.api.listDatabaseConnections(),
      window.api.listServiceHubs()
    ]);

    const providers: SyncProviderProgress[] = [
      ...connections.map((connection) => ({
        id: connection.id,
        name: connection.name,
        kind: 'database' as const,
        status: 'pending' as const,
        error: null
      })),
      ...hubs.map((hub) => ({
        id: hub.id,
        name: hub.name,
        kind: 'service-hub' as const,
        status: 'pending' as const,
        error: null
      }))
    ];

    dispatch(setSyncProviders(providers));

    for (const provider of providers) {
      dispatch(setSyncProviderStatus({ id: provider.id, status: 'syncing' }));
      try {
        await window.api.syncProvider(provider.id);
        dispatch(setSyncProviderStatus({ id: provider.id, status: 'success', error: null }));
      } catch (err: unknown) {
        dispatch(
          setSyncProviderStatus({
            id: provider.id,
            status: 'error',
            error: formatErrorMessage(err, 'Sync failed')
          })
        );
      }
      dispatch(incrementSyncCompleted());
    }

    await dispatch(refreshCollections());
    await dispatch(refreshEnvironments());

    const cachedCollectionIds = Object.keys(getState().collections.foldersByCollection).map(Number);
    for (const collectionId of cachedCollectionIds) {
      await dispatch(refreshCollectionContents(collectionId));
    }

    dispatch(finishSync());
  }
);
