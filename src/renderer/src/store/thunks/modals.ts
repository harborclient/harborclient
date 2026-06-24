import { createAsyncThunk } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import {
  closeCollectionModal,
  setAboutVersion,
  setShareToken,
  setShareTokenError,
  setShareTokenLoading,
  setShareTrustedKeys,
  setShareTrustedKeysLoading,
  setUpdateError,
  setUpdateLoading,
  setUpdateResult
} from '#/renderer/src/store/slices/modalsSlice';
import type { ThunkApiConfig } from '#/renderer/src/store/redux';
import { refreshCollections } from '#/renderer/src/store/thunks/collections';

/**
 * Loads trusted keys for the share modal recipient picker.
 */
export const loadTrustedKeys = createAsyncThunk<void, void, ThunkApiConfig>(
  'modals/loadTrustedKeys',
  async (_, { dispatch }) => {
    dispatch(setShareTrustedKeysLoading(true));
    dispatch(setShareTokenError(null));
    try {
      const keys = await window.api.listTrustedKeys();
      dispatch(setShareTrustedKeys(keys));
    } catch (err) {
      dispatch(
        setShareTokenError(err instanceof Error ? err.message : 'Failed to load trusted keys')
      );
      dispatch(setShareTrustedKeys([]));
    } finally {
      dispatch(setShareTrustedKeysLoading(false));
    }
  }
);

/**
 * Generates an encrypted share token for the selected recipient.
 */
export const generateShareToken = createAsyncThunk<void, void, ThunkApiConfig>(
  'modals/generateShareToken',
  async (_, { dispatch, getState }) => {
    const share = getState().modals.share;
    if (!share || !share.recipientKid) return;

    dispatch(setShareTokenLoading(true));
    dispatch(setShareTokenError(null));
    dispatch(setShareToken(''));

    try {
      const token = await window.api.createShareToken(share.collectionId, share.recipientKid);
      dispatch(setShareToken(token));
    } catch (err) {
      dispatch(
        setShareTokenError(err instanceof Error ? err.message : 'Failed to create share token')
      );
    } finally {
      dispatch(setShareTokenLoading(false));
    }
  }
);

/**
 * Joins a shared collection from a share JWT and refreshes collections.
 */
export const joinSharedCollection = createAsyncThunk<void, string, ThunkApiConfig>(
  'modals/joinSharedCollection',
  async (token, { dispatch }) => {
    await window.api.joinSharedCollection(token);
    await dispatch(refreshCollections());
    dispatch(closeCollectionModal());
    toast.success('Shared connection added');
  }
);

/**
 * Fetches the application version for the about dialog.
 */
export const fetchAppVersion = createAsyncThunk<string, void, ThunkApiConfig>(
  'modals/fetchAppVersion',
  async (_, { dispatch }) => {
    const version = await window.api.getAppVersion();
    dispatch(setAboutVersion(version));
    return version;
  }
);

/**
 * Checks GitHub for a newer release and stores the result for the update modal.
 */
export const checkForUpdates = createAsyncThunk<void, void, ThunkApiConfig>(
  'modals/checkForUpdates',
  async (_, { dispatch }) => {
    dispatch(setUpdateLoading(true));
    dispatch(setUpdateError(null));
    dispatch(setUpdateResult(null));

    try {
      const result = await window.api.checkForUpdates();
      dispatch(setUpdateResult(result));
    } catch (err) {
      dispatch(setUpdateError(err instanceof Error ? err.message : 'Failed to check for updates'));
    } finally {
      dispatch(setUpdateLoading(false));
    }
  }
);
