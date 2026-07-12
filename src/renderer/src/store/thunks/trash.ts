import { createAsyncThunk } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import type { TrashEntityType } from '#/shared/types/trash';
import type { Dispatch } from '@reduxjs/toolkit';
import type { AppDispatch, ThunkApiConfig } from '#/renderer/src/store/redux';
import { removeTrashItem, setTrashItems } from '#/renderer/src/store/slices/trashSlice';
import { formatErrorMessage } from '#/renderer/src/ui/modals/dialogHelpers';

/**
 * Reloads trash rows from the main process into the store.
 *
 * @param dispatch - Redux dispatch function.
 */
export async function syncTrash(dispatch: Dispatch): Promise<void> {
  const items = await window.api.listTrashItems();
  dispatch(setTrashItems(items));
}

/**
 * Reloads trash snapshot rows from the registry database into the store.
 */
export const refreshTrash = createAsyncThunk<void, void, ThunkApiConfig>(
  'trash/refresh',
  async (_arg, { dispatch }) => {
    await syncTrash(dispatch);
  }
);

/**
 * Refreshes store slices affected by restoring a trash item.
 *
 * @param dispatch - Redux dispatch function.
 * @param entityType - Restored sidebar entity kind.
 */
async function refreshAfterRestore(
  dispatch: AppDispatch,
  entityType: TrashEntityType
): Promise<void> {
  switch (entityType) {
    case 'collection':
    case 'folder':
    case 'request':
    case 'document':
      await dispatch(
        (await import('#/renderer/src/store/thunks/collections')).refreshCollections()
      );
      break;
    case 'environment':
      await dispatch(
        (await import('#/renderer/src/store/thunks/environments')).refreshEnvironments()
      );
      break;
    case 'runResult':
      await dispatch((await import('#/renderer/src/store/thunks/runResults')).refreshRunResults());
      break;
    case 'history':
      await dispatch(
        (await import('#/renderer/src/store/thunks/requestHistory')).refreshRequestHistory()
      );
      break;
    case 'tabGroup':
      await dispatch((await import('#/renderer/src/store/thunks/tabGroups')).refreshTabGroups());
      break;
    default:
      break;
  }
}

/**
 * Restores one trash snapshot row and refreshes affected sidebar data.
 */
export const restoreTrashItem = createAsyncThunk<void, number, ThunkApiConfig>(
  'trash/restore',
  async (id, { dispatch }) => {
    try {
      const entityType = await window.api.restoreTrashItem(id);
      dispatch(removeTrashItem(id));
      await refreshAfterRestore(dispatch as AppDispatch, entityType);
      toast.success('Restored from trash');
    } catch (error) {
      toast.error(formatErrorMessage(error, 'Failed to restore item'));
      throw error;
    }
  }
);

/**
 * Permanently deletes one trash snapshot row.
 */
export const permanentlyDeleteTrashItem = createAsyncThunk<void, number, ThunkApiConfig>(
  'trash/permanentlyDelete',
  async (id, { dispatch }) => {
    await window.api.permanentlyDeleteTrashItem(id);
    dispatch(removeTrashItem(id));
  }
);

/**
 * Permanently deletes every trash snapshot row.
 */
export const emptyTrash = createAsyncThunk<void, void, ThunkApiConfig>(
  'trash/empty',
  async (_arg, { dispatch }) => {
    await window.api.emptyTrash();
    dispatch(setTrashItems([]));
  }
);
