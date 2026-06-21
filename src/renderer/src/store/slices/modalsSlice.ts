import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { SavedRequest, TrustedInviteKey } from '#/shared/types';
import type { RootState } from '#/renderer/src/store/redux';

export type CollectionModalMode = 'create' | 'create-and-save';
export type CollectionModalTab = 'create' | 'import' | 'invite';

export interface CollectionModalState {
  mode: CollectionModalMode;
  tab: CollectionModalTab;
  name: string;
  inviteTokenInput: string;
}

export interface InviteModalState {
  collectionId: number;
  collectionName: string;
  recipientKid: string;
  token: string;
  tokenLoading: boolean;
  tokenError: string | null;
  trustedKeys: TrustedInviteKey[];
  trustedKeysLoading: boolean;
}

export interface AboutModalState {
  open: boolean;
  version: string;
}

/**
 * Saved request queued for load after the user confirms discarding unsaved edits.
 */
export interface PendingLoadRequest {
  req: SavedRequest;
  reason: 'settings' | 'dirty-tab';
}

export interface ModalsState {
  collectionModal: CollectionModalState | null;
  invite: InviteModalState | null;
  pendingLoadRequest: PendingLoadRequest | null;
  quitPrompt: string[] | null;
  about: AboutModalState;
}

const initialState: ModalsState = {
  collectionModal: null,
  invite: null,
  pendingLoadRequest: null,
  quitPrompt: null,
  about: { open: false, version: '' }
};

const modalsSlice = createSlice({
  name: 'modals',
  initialState,
  reducers: {
    /**
     * Opens the create/import/invite collection modal.
     */
    openCollectionModal(
      state,
      action: PayloadAction<{ mode: CollectionModalMode; tab?: CollectionModalTab }>
    ) {
      state.collectionModal = {
        mode: action.payload.mode,
        tab: action.payload.tab ?? 'create',
        name: '',
        inviteTokenInput: ''
      };
    },
    /**
     * Closes the collection modal.
     */
    closeCollectionModal(state) {
      state.collectionModal = null;
    },
    /**
     * Switches the active tab within the collection modal.
     */
    setCollectionModalTab(state, action: PayloadAction<CollectionModalTab>) {
      if (state.collectionModal) {
        state.collectionModal.tab = action.payload;
      }
    },
    /**
     * Updates the collection name field in the modal.
     */
    setCollectionModalName(state, action: PayloadAction<string>) {
      if (state.collectionModal) {
        state.collectionModal.name = action.payload;
      }
    },
    /**
     * Updates the invite token paste field.
     */
    setCollectionModalInviteTokenInput(state, action: PayloadAction<string>) {
      if (state.collectionModal) {
        state.collectionModal.inviteTokenInput = action.payload;
      }
    },
    /**
     * Opens invite generation for a collection.
     */
    openInviteModal(
      state,
      action: PayloadAction<{ collectionId: number; collectionName: string }>
    ) {
      state.invite = {
        collectionId: action.payload.collectionId,
        collectionName: action.payload.collectionName,
        recipientKid: '',
        token: '',
        tokenLoading: false,
        tokenError: null,
        trustedKeys: [],
        trustedKeysLoading: true
      };
    },
    /**
     * Closes the invite modal.
     */
    closeInviteModal(state) {
      state.invite = null;
    },
    /**
     * Sets the selected trusted key for invite generation.
     */
    setInviteRecipientKid(state, action: PayloadAction<string>) {
      if (state.invite) {
        state.invite.recipientKid = action.payload;
        state.invite.token = '';
        state.invite.tokenError = null;
      }
    },
    /**
     * Tracks trusted key list loading state.
     */
    setInviteTrustedKeysLoading(state, action: PayloadAction<boolean>) {
      if (state.invite) {
        state.invite.trustedKeysLoading = action.payload;
      }
    },
    /**
     * Stores trusted keys for the invite recipient picker.
     */
    setInviteTrustedKeys(state, action: PayloadAction<TrustedInviteKey[]>) {
      if (state.invite) {
        state.invite.trustedKeys = action.payload;
      }
    },
    /**
     * Tracks invite token generation loading state.
     */
    setInviteTokenLoading(state, action: PayloadAction<boolean>) {
      if (state.invite) {
        state.invite.tokenLoading = action.payload;
      }
    },
    /**
     * Stores a generated invite token.
     */
    setInviteToken(state, action: PayloadAction<string>) {
      if (state.invite) {
        state.invite.token = action.payload;
      }
    },
    /**
     * Stores an invite token generation error message.
     */
    setInviteTokenError(state, action: PayloadAction<string | null>) {
      if (state.invite) {
        state.invite.tokenError = action.payload;
      }
    },
    /**
     * Queues a saved request to load after unsaved prompt.
     */
    setPendingLoadRequest(state, action: PayloadAction<PendingLoadRequest | null>) {
      state.pendingLoadRequest = action.payload;
    },
    /**
     * Shows the quit prompt with dirty tab names.
     */
    setQuitPrompt(state, action: PayloadAction<string[] | null>) {
      state.quitPrompt = action.payload;
    },
    /**
     * Opens the about dialog.
     */
    openAboutModal(state) {
      state.about = { open: true, version: '' };
    },
    /**
     * Closes the about dialog.
     */
    closeAboutModal(state) {
      state.about = { open: false, version: '' };
    },
    /**
     * Sets the version string shown in the about dialog.
     */
    setAboutVersion(state, action: PayloadAction<string>) {
      state.about.version = action.payload;
    }
  }
});

export const {
  openCollectionModal,
  closeCollectionModal,
  setCollectionModalTab,
  setCollectionModalName,
  setCollectionModalInviteTokenInput,
  openInviteModal,
  closeInviteModal,
  setInviteRecipientKid,
  setInviteTrustedKeysLoading,
  setInviteTrustedKeys,
  setInviteTokenLoading,
  setInviteToken,
  setInviteTokenError,
  setPendingLoadRequest,
  setQuitPrompt,
  openAboutModal,
  closeAboutModal,
  setAboutVersion
} = modalsSlice.actions;

/**
 * Returns collection modal state when open.
 */
export const selectCollectionModal = (state: RootState): CollectionModalState | null =>
  state.modals.collectionModal;
/**
 * Returns invite modal state when open.
 */
export const selectInviteModal = (state: RootState): InviteModalState | null => state.modals.invite;
/**
 * Returns a request waiting on unsaved-load confirmation.
 */
export const selectPendingLoadRequest = (state: RootState): PendingLoadRequest | null =>
  state.modals.pendingLoadRequest;
/**
 * Returns dirty tab names for the quit prompt.
 */
export const selectQuitPrompt = (state: RootState): string[] | null => state.modals.quitPrompt;
/**
 * Returns about dialog open state and version.
 */
export const selectAboutModal = (state: RootState): AboutModalState => state.modals.about;

export default modalsSlice.reducer;
