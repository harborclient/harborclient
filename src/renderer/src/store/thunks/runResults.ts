import { createAsyncThunk } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import { resolveImportedRunnerTargetIds } from '#/shared/collectionRunner';
import type { SaveRunResultInput } from '#/shared/collectionRunner';
import type { ThunkApiConfig } from '#/renderer/src/store/redux';
import {
  importCollectionRunnerResults,
  markCollectionRunnerSaved
} from '#/renderer/src/store/slices/modalsSlice';
import { removeRunResult, setRunResults } from '#/renderer/src/store/slices/runResultsSlice';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';

/**
 * Reloads saved run results from all storage providers into the store.
 */
export const refreshRunResults = createAsyncThunk<void, void, ThunkApiConfig>(
  'runResults/refresh',
  async (_arg, { dispatch }) => {
    const items = await window.api.listSavedRunResults();
    dispatch(setRunResults(items));
  }
);

/**
 * Saves a run result snapshot to the selected storage provider.
 */
export const saveRunResult = createAsyncThunk<
  void,
  { connectionId: string; input: SaveRunResultInput; savedToTeamHub: boolean },
  ThunkApiConfig
>('runResults/save', async ({ connectionId, input, savedToTeamHub }, { dispatch }) => {
  const saved = await window.api.saveRunResult(connectionId, input);
  dispatch(
    markCollectionRunnerSaved({
      savedRunUuid: saved.uuid,
      savedConnectionId: saved.connectionId,
      savedToTeamHub
    })
  );
  await dispatch(refreshRunResults());
  toast.success('Run results saved');
});

/**
 * Deletes a saved run result snapshot and refreshes the sidebar list.
 */
export const deleteRunResult = createAsyncThunk<number, number, ThunkApiConfig>(
  'runResults/delete',
  async (id, { dispatch }) => {
    await window.api.deleteSavedRunResult(id);
    dispatch(removeRunResult(id));
    return id;
  }
);

/**
 * Returns whether a connection id refers to a configured Team Hub.
 *
 * @param connectionId - Provider connection id from a saved run result row.
 */
async function isTeamHubConnection(connectionId: string): Promise<boolean> {
  const hubs = await window.api.listTeamHubs();
  return hubs.some((hub) => hub.id === connectionId);
}

/**
 * Opens a saved run result in the read-only collection runner page tab.
 */
export const openSavedRunResult = createAsyncThunk<number, number, ThunkApiConfig>(
  'runResults/open',
  async (id, { dispatch, getState }) => {
    const saved = await window.api.getSavedRunResult(id);
    if (!saved) {
      toast.error('Run result not found');
      throw new Error('Run result not found');
    }

    const state = getState();
    const { collectionId, requestId } = resolveImportedRunnerTargetIds(
      saved.payload,
      state.collections.collections,
      state.collections.requestsByCollection
    );

    dispatch(
      importCollectionRunnerResults({
        ...saved.payload,
        collectionId,
        requestId,
        savedRunUuid: saved.uuid,
        savedConnectionId: saved.connectionId,
        savedToTeamHub: await isTeamHubConnection(saved.connectionId)
      })
    );
    dispatch(
      openPageTab({
        type: 'collection-runner',
        collectionId: collectionId > 0 ? collectionId : 0
      })
    );

    return id;
  }
);

/**
 * Opens a shared run result from a Team Hub deep link UUID.
 */
export const openRunResultByUuid = createAsyncThunk<string, string, ThunkApiConfig>(
  'runResults/openByUuid',
  async (uuid, { dispatch, getState }) => {
    const saved = await window.api.resolveRunResultByUuid(uuid);
    if (!saved) {
      toast.error('Run result not found on any connected Team Hub');
      throw new Error('Run result not found');
    }

    const state = getState();
    const { collectionId, requestId } = resolveImportedRunnerTargetIds(
      saved.payload,
      state.collections.collections,
      state.collections.requestsByCollection
    );

    dispatch(
      importCollectionRunnerResults({
        ...saved.payload,
        collectionId,
        requestId,
        savedRunUuid: saved.uuid,
        savedConnectionId: saved.connectionId,
        savedToTeamHub: true
      })
    );
    dispatch(
      openPageTab({
        type: 'collection-runner',
        collectionId: collectionId > 0 ? collectionId : 0
      })
    );

    return uuid;
  }
);
