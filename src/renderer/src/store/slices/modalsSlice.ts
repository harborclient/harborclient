import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { SavedRequest, TrustedSharingKey, UpdateCheckResult } from '#/shared/types';
import type {
  CollectionRunnerConfig,
  CollectionRunnerRequestResult,
  CollectionRunnerResultStatus
} from '#/shared/collectionRunner';
import { DEFAULT_COLLECTION_RUNNER_CONFIG } from '#/shared/collectionRunner';
import type { RootState } from '#/renderer/src/store/redux';

export type CollectionModalMode = 'create' | 'create-and-save';
export type CollectionModalTab = 'create' | 'import' | 'join';

export interface CollectionModalState {
  mode: CollectionModalMode;
  tab: CollectionModalTab;
  name: string;
  providerId: string;
  shareTokenInput: string;
  submitError: string | null;
}

export interface AlertModalState {
  title: string;
  message: string;
  icon?: 'warning';
}

export interface ConfirmModalState {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: 'default' | 'danger';
}

export interface ShareModalState {
  collectionId: number;
  collectionName: string;
  recipientKid: string;
  token: string;
  tokenLoading: boolean;
  tokenError: string | null;
  trustedKeys: TrustedSharingKey[];
  trustedKeysLoading: boolean;
}

export interface AboutModalState {
  open: boolean;
  version: string;
}

export interface UpdateModalState {
  open: boolean;
  loading: boolean;
  result: UpdateCheckResult | null;
  error: string | null;
}

/**
 * Per-provider progress row shown in the sync modal.
 */
export interface SyncProviderProgress {
  id: string;
  name: string;
  kind: 'database' | 'team-hub';
  status: 'pending' | 'syncing' | 'success' | 'error';
  error: string | null;
}

/**
 * Sync-all modal state with determinate per-provider progress.
 */
export interface SyncModalState {
  open: boolean;
  running: boolean;
  providers: SyncProviderProgress[];
  completed: number;
  total: number;
}

export type CollectionRunnerPhase = 'configure' | 'running' | 'complete';

/**
 * Aggregate pass/fail counts for a finished collection run.
 */
export interface CollectionRunnerSummary {
  passed: number;
  failed: number;
  skipped: number;
}

/**
 * Collection runner modal state spanning configuration, progress, and summary.
 */
export interface CollectionRunnerModalState {
  collectionId: number;
  folderId: number | null;
  collectionName: string;
  folderName: string | null;
  phase: CollectionRunnerPhase;
  delayMs: number;
  stopOnFailure: boolean;
  environmentMode: CollectionRunnerConfig['environmentMode'];
  environmentId: number | null;
  running: boolean;
  cancelled: boolean;
  completed: number;
  total: number;
  results: CollectionRunnerRequestResult[];
  summary: CollectionRunnerSummary;
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
  share: ShareModalState | null;
  pendingLoadRequest: PendingLoadRequest | null;
  quitPrompt: string[] | null;
  about: AboutModalState;
  update: UpdateModalState;
  syncModal: SyncModalState;
  collectionRunner: CollectionRunnerModalState | null;
  alertModal: AlertModalState | null;
  confirmModal: ConfirmModalState | null;
}

const initialState: ModalsState = {
  collectionModal: null,
  share: null,
  pendingLoadRequest: null,
  quitPrompt: null,
  about: { open: false, version: '' },
  update: { open: false, loading: false, result: null, error: null },
  syncModal: { open: false, running: false, providers: [], completed: 0, total: 0 },
  collectionRunner: null,
  alertModal: null,
  confirmModal: null
};

const modalsSlice = createSlice({
  name: 'modals',
  initialState,
  reducers: {
    /**
     * Opens the create/import/join collection modal.
     */
    openCollectionModal(
      state,
      action: PayloadAction<{ mode: CollectionModalMode; tab?: CollectionModalTab }>
    ) {
      state.collectionModal = {
        mode: action.payload.mode,
        tab: action.payload.tab ?? 'create',
        name: '',
        providerId: '',
        shareTokenInput: '',
        submitError: null
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
        state.collectionModal.submitError = null;
      }
    },
    /**
     * Updates the collection name field in the modal.
     */
    setCollectionModalName(state, action: PayloadAction<string>) {
      if (state.collectionModal) {
        state.collectionModal.name = action.payload;
        state.collectionModal.submitError = null;
      }
    },
    /**
     * Updates the selected provider for a new collection.
     */
    setCollectionModalProviderId(state, action: PayloadAction<string>) {
      if (state.collectionModal) {
        state.collectionModal.providerId = action.payload;
        state.collectionModal.submitError = null;
      }
    },
    /**
     * Updates the share token paste field.
     */
    setCollectionModalShareTokenInput(state, action: PayloadAction<string>) {
      if (state.collectionModal) {
        state.collectionModal.shareTokenInput = action.payload;
        state.collectionModal.submitError = null;
      }
    },
    /**
     * Stores a submit error shown inline in the collection modal.
     */
    setCollectionModalSubmitError(state, action: PayloadAction<string | null>) {
      if (state.collectionModal) {
        state.collectionModal.submitError = action.payload;
      }
    },
    /**
     * Opens share token generation for a collection.
     */
    openShareModal(state, action: PayloadAction<{ collectionId: number; collectionName: string }>) {
      state.share = {
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
     * Closes the share modal.
     */
    closeShareModal(state) {
      state.share = null;
    },
    /**
     * Sets the selected trusted key for share token generation.
     */
    setShareRecipientKid(state, action: PayloadAction<string>) {
      if (state.share) {
        state.share.recipientKid = action.payload;
        state.share.token = '';
        state.share.tokenError = null;
      }
    },
    /**
     * Tracks trusted key list loading state.
     */
    setShareTrustedKeysLoading(state, action: PayloadAction<boolean>) {
      if (state.share) {
        state.share.trustedKeysLoading = action.payload;
      }
    },
    /**
     * Stores trusted keys for the share recipient picker.
     */
    setShareTrustedKeys(state, action: PayloadAction<TrustedSharingKey[]>) {
      if (state.share) {
        state.share.trustedKeys = action.payload;
      }
    },
    /**
     * Tracks share token generation loading state.
     */
    setShareTokenLoading(state, action: PayloadAction<boolean>) {
      if (state.share) {
        state.share.tokenLoading = action.payload;
      }
    },
    /**
     * Stores a generated share token.
     */
    setShareToken(state, action: PayloadAction<string>) {
      if (state.share) {
        state.share.token = action.payload;
      }
    },
    /**
     * Stores a share token generation error message.
     */
    setShareTokenError(state, action: PayloadAction<string | null>) {
      if (state.share) {
        state.share.tokenError = action.payload;
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
    },
    /**
     * Opens the check-for-updates dialog.
     */
    openUpdateModal(state) {
      state.update = { open: true, loading: false, result: null, error: null };
    },
    /**
     * Closes the check-for-updates dialog.
     */
    closeUpdateModal(state) {
      state.update = { open: false, loading: false, result: null, error: null };
    },
    /**
     * Tracks update-check loading state in the modal.
     */
    setUpdateLoading(state, action: PayloadAction<boolean>) {
      state.update.loading = action.payload;
    },
    /**
     * Stores the update-check result shown in the modal.
     */
    setUpdateResult(state, action: PayloadAction<UpdateCheckResult | null>) {
      state.update.result = action.payload;
    },
    /**
     * Stores an update-check error message shown in the modal.
     */
    setUpdateError(state, action: PayloadAction<string | null>) {
      state.update.error = action.payload;
    },
    /**
     * Opens the sync-all modal in a running state.
     */
    openSyncModal(state) {
      state.syncModal = { open: true, running: true, providers: [], completed: 0, total: 0 };
    },
    /**
     * Closes the sync-all modal and resets its state.
     */
    closeSyncModal(state) {
      state.syncModal = { open: false, running: false, providers: [], completed: 0, total: 0 };
    },
    /**
     * Initializes the provider list for a sync run.
     */
    setSyncProviders(state, action: PayloadAction<SyncProviderProgress[]>) {
      state.syncModal.providers = action.payload;
      state.syncModal.total = action.payload.length;
      state.syncModal.completed = 0;
    },
    /**
     * Updates status and optional error for one provider in the sync list.
     */
    setSyncProviderStatus(
      state,
      action: PayloadAction<{
        id: string;
        status: SyncProviderProgress['status'];
        error?: string | null;
      }>
    ) {
      const provider = state.syncModal.providers.find((item) => item.id === action.payload.id);
      if (provider) {
        provider.status = action.payload.status;
        if (action.payload.error !== undefined) {
          provider.error = action.payload.error;
        }
      }
    },
    /**
     * Increments the completed provider count for the progress bar.
     */
    incrementSyncCompleted(state) {
      state.syncModal.completed += 1;
    },
    /**
     * Marks the sync run as finished so the summary view is shown.
     */
    finishSync(state) {
      state.syncModal.running = false;
    },
    /**
     * Opens the collection runner modal for a collection or folder target.
     */
    openCollectionRunnerModal(
      state,
      action: PayloadAction<{
        collectionId: number;
        folderId?: number | null;
        collectionName: string;
        folderName?: string | null;
        config?: Partial<CollectionRunnerConfig>;
      }>
    ) {
      const config = {
        ...DEFAULT_COLLECTION_RUNNER_CONFIG,
        ...action.payload.config
      };
      state.collectionRunner = {
        collectionId: action.payload.collectionId,
        folderId: action.payload.folderId ?? null,
        collectionName: action.payload.collectionName,
        folderName: action.payload.folderName ?? null,
        phase: 'configure',
        delayMs: config.delayMs,
        stopOnFailure: config.stopOnFailure,
        environmentMode: config.environmentMode,
        environmentId: config.environmentId,
        running: false,
        cancelled: false,
        completed: 0,
        total: 0,
        results: [],
        summary: { passed: 0, failed: 0, skipped: 0 }
      };
    },
    /**
     * Closes the collection runner modal and clears run state.
     */
    closeCollectionRunnerModal(state) {
      state.collectionRunner = null;
    },
    /**
     * Updates editable runner settings while the modal is in configure phase.
     */
    setCollectionRunnerConfig(state, action: PayloadAction<Partial<CollectionRunnerConfig>>) {
      if (!state.collectionRunner || state.collectionRunner.phase !== 'configure') {
        return;
      }
      if (action.payload.delayMs != null) {
        state.collectionRunner.delayMs = action.payload.delayMs;
      }
      if (action.payload.stopOnFailure != null) {
        state.collectionRunner.stopOnFailure = action.payload.stopOnFailure;
      }
      if (action.payload.environmentMode != null) {
        state.collectionRunner.environmentMode = action.payload.environmentMode;
        if (action.payload.environmentMode === 'active') {
          state.collectionRunner.environmentId = null;
        }
      }
      if (action.payload.environmentId !== undefined) {
        state.collectionRunner.environmentId = action.payload.environmentId;
      }
    },
    /**
     * Initializes run progress rows and transitions to the running phase.
     */
    startCollectionRunner(
      state,
      action: PayloadAction<{ results: CollectionRunnerRequestResult[] }>
    ) {
      if (!state.collectionRunner) {
        return;
      }
      state.collectionRunner.phase = 'running';
      state.collectionRunner.running = true;
      state.collectionRunner.cancelled = false;
      state.collectionRunner.completed = 0;
      state.collectionRunner.total = action.payload.results.length;
      state.collectionRunner.results = action.payload.results;
      state.collectionRunner.summary = { passed: 0, failed: 0, skipped: 0 };
    },
    /**
     * Marks one request row as currently running.
     */
    setCollectionRunnerRequestRunning(state, action: PayloadAction<number>) {
      const row = state.collectionRunner?.results.find(
        (result) => result.requestId === action.payload
      );
      if (row) {
        row.status = 'running';
      }
    },
    /**
     * Stores the outcome for a completed request and advances progress counters.
     */
    appendCollectionRunnerResult(
      state,
      action: PayloadAction<{
        requestId: number;
        status: Exclude<CollectionRunnerResultStatus, 'pending' | 'running'>;
        httpStatus?: number;
        httpError?: string;
        testsPassed: number;
        testsFailed: number;
      }>
    ) {
      if (!state.collectionRunner) {
        return;
      }
      const row = state.collectionRunner.results.find(
        (result) => result.requestId === action.payload.requestId
      );
      if (!row) {
        return;
      }
      row.status = action.payload.status;
      row.httpStatus = action.payload.httpStatus;
      row.httpError = action.payload.httpError;
      row.testsPassed = action.payload.testsPassed;
      row.testsFailed = action.payload.testsFailed;
      state.collectionRunner.completed += 1;
      if (action.payload.status === 'passed') {
        state.collectionRunner.summary.passed += 1;
      } else if (action.payload.status === 'failed') {
        state.collectionRunner.summary.failed += 1;
      } else if (action.payload.status === 'skipped') {
        state.collectionRunner.summary.skipped += 1;
      }
    },
    /**
     * Marks remaining pending requests as skipped after stop-on-failure or cancel.
     */
    skipRemainingCollectionRunnerRequests(state) {
      if (!state.collectionRunner) {
        return;
      }
      for (const row of state.collectionRunner.results) {
        if (row.status === 'pending') {
          row.status = 'skipped';
          state.collectionRunner.summary.skipped += 1;
        }
      }
      state.collectionRunner.completed = state.collectionRunner.total;
    },
    /**
     * Requests cancellation; the run loop stops before the next request loads.
     */
    cancelCollectionRunner(state) {
      if (state.collectionRunner?.running) {
        state.collectionRunner.cancelled = true;
      }
    },
    /**
     * Marks the collection run as finished and shows the summary phase.
     */
    finishCollectionRunner(state) {
      if (!state.collectionRunner) {
        return;
      }
      state.collectionRunner.running = false;
      state.collectionRunner.phase = 'complete';
    },
    /**
     * Opens or closes the global alert dialog.
     */
    setAlertModal(state, action: PayloadAction<AlertModalState | null>) {
      state.alertModal = action.payload;
    },
    /**
     * Opens or closes the global confirmation dialog.
     */
    setConfirmModal(state, action: PayloadAction<ConfirmModalState | null>) {
      state.confirmModal = action.payload;
    }
  }
});

export const {
  openCollectionModal,
  closeCollectionModal,
  setCollectionModalTab,
  setCollectionModalName,
  setCollectionModalProviderId,
  setCollectionModalShareTokenInput,
  setCollectionModalSubmitError,
  openShareModal,
  closeShareModal,
  setShareRecipientKid,
  setShareTrustedKeysLoading,
  setShareTrustedKeys,
  setShareTokenLoading,
  setShareToken,
  setShareTokenError,
  setPendingLoadRequest,
  setQuitPrompt,
  openAboutModal,
  closeAboutModal,
  setAboutVersion,
  openUpdateModal,
  closeUpdateModal,
  setUpdateLoading,
  setUpdateResult,
  setUpdateError,
  openSyncModal,
  closeSyncModal,
  setSyncProviders,
  setSyncProviderStatus,
  incrementSyncCompleted,
  finishSync,
  openCollectionRunnerModal,
  closeCollectionRunnerModal,
  setCollectionRunnerConfig,
  startCollectionRunner,
  setCollectionRunnerRequestRunning,
  appendCollectionRunnerResult,
  skipRemainingCollectionRunnerRequests,
  cancelCollectionRunner,
  finishCollectionRunner,
  setAlertModal,
  setConfirmModal
} = modalsSlice.actions;

/**
 * Returns collection modal state when open.
 */
export const selectCollectionModal = (state: RootState): CollectionModalState | null =>
  state.modals.collectionModal;
/**
 * Returns share modal state when open.
 */
export const selectShareModal = (state: RootState): ShareModalState | null => state.modals.share;
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
/**
 * Returns check-for-updates dialog state.
 */
export const selectUpdateModal = (state: RootState): UpdateModalState => state.modals.update;
/**
 * Returns sync-all modal state.
 */
export const selectSyncModal = (state: RootState): SyncModalState => state.modals.syncModal;
/**
 * Returns collection runner modal state when open.
 */
export const selectCollectionRunnerModal = (state: RootState): CollectionRunnerModalState | null =>
  state.modals.collectionRunner;
/**
 * Returns alert dialog state when open.
 */
export const selectAlertModal = (state: RootState): AlertModalState | null =>
  state.modals.alertModal;
/**
 * Returns confirmation dialog state when open.
 */
export const selectConfirmModal = (state: RootState): ConfirmModalState | null =>
  state.modals.confirmModal;

export default modalsSlice.reducer;
