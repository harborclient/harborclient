import { createAsyncThunk } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import {
  closeCollectionModal,
  setAboutVersion,
  setInviteToken,
  setInviteTokenError,
  setInviteTokenLoading,
  setInviteTrustedKeys,
  setInviteTrustedKeysLoading
} from '#/renderer/src/store/slices/modalsSlice';
import type { ThunkApiConfig } from '#/renderer/src/store/redux';
import { refreshCollections } from '#/renderer/src/store/thunks/collections';

/** Loads trusted keys for the invite modal recipient picker. */
export const loadTrustedKeys = createAsyncThunk<void, void, ThunkApiConfig>(
  'modals/loadTrustedKeys',
  async (_, { dispatch }) => {
    dispatch(setInviteTrustedKeysLoading(true));
    dispatch(setInviteTokenError(null));
    try {
      const keys = await window.api.listTrustedKeys();
      dispatch(setInviteTrustedKeys(keys));
    } catch (err) {
      dispatch(
        setInviteTokenError(err instanceof Error ? err.message : 'Failed to load trusted keys')
      );
      dispatch(setInviteTrustedKeys([]));
    } finally {
      dispatch(setInviteTrustedKeysLoading(false));
    }
  }
);

/** Generates an encrypted invite token for the selected recipient. */
export const generateInviteToken = createAsyncThunk<void, void, ThunkApiConfig>(
  'modals/generateInviteToken',
  async (_, { dispatch, getState }) => {
    const invite = getState().modals.invite;
    if (!invite || !invite.recipientKid) return;

    dispatch(setInviteTokenLoading(true));
    dispatch(setInviteTokenError(null));
    dispatch(setInviteToken(''));

    try {
      const token = await window.api.createInviteToken(invite.collectionId, invite.recipientKid);
      dispatch(setInviteToken(token));
    } catch (err) {
      dispatch(
        setInviteTokenError(err instanceof Error ? err.message : 'Failed to create invite token')
      );
    } finally {
      dispatch(setInviteTokenLoading(false));
    }
  }
);

/** Accepts an invite JWT and refreshes collections. */
export const acceptInviteToken = createAsyncThunk<void, string, ThunkApiConfig>(
  'modals/acceptInviteToken',
  async (token, { dispatch }) => {
    await window.api.acceptInvite(token);
    await dispatch(refreshCollections());
    dispatch(closeCollectionModal());
    toast.success('Shared connection added');
  }
);

/** Fetches the application version for the about dialog. */
export const fetchAppVersion = createAsyncThunk<string, void, ThunkApiConfig>(
  'modals/fetchAppVersion',
  async (_, { dispatch }) => {
    const version = await window.api.getAppVersion();
    dispatch(setAboutVersion(version));
    return version;
  }
);
