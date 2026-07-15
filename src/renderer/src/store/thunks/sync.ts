import { createAsyncThunk } from '@reduxjs/toolkit';
import type { ThunkApiConfig } from '#/renderer/src/store/redux';
import {
  finishSync,
  incrementSyncCompleted,
  setSyncProviderStatus,
  setSyncProviders,
  type SyncProviderProgress
} from '#/renderer/src/store/slices/modalsSlice';
import { refreshCollectionContents, refreshCollections } from './collections';
import { refreshEnvironments } from './environments';
import { formatErrorMessage } from '#/renderer/src/ui/Modals/dialogHelpers';

/**
 * Syncs every configured provider sequentially, then refreshes collections,
 * environments, and any cached collection contents in the renderer.
 */
export const runSync = createAsyncThunk<void, void, ThunkApiConfig>(
  'sync/run',
  async (_, { dispatch, getState }) => {
    const [connections, hubs] = await Promise.all([
      window.api.listStorageConnections(),
      window.api.listTeamHubs()
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
        kind: 'team-hub' as const,
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

    const validCollectionIds = new Set(
      getState().collections.collections.map((collection) => collection.id)
    );
    const cachedCollectionIds = Object.keys(getState().collections.foldersByCollection)
      .map(Number)
      .filter((collectionId) => validCollectionIds.has(collectionId));
    for (const collectionId of cachedCollectionIds) {
      await dispatch(refreshCollectionContents(collectionId));
    }

    dispatch(finishSync());
  }
);
