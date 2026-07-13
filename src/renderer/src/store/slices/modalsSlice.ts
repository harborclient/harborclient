import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type {
  CollectionDocument,
  SavedRequest,
  ScriptExecutionEvent,
  ScriptTestResult,
  SendResult,
  TrustedSharingKey,
  UpdateCheckResult
} from '#/shared/types';
import type {
  CollectionRunnerConfig,
  CollectionRunnerRequestResult,
  CollectionRunnerResultStatus,
  RunResultsExport
} from '#/shared/collectionRunner';
import {
  DEFAULT_COLLECTION_RUNNER_CONFIG,
  summarizeRunnerResults
} from '#/shared/collectionRunner';
import type { RootState } from '#/renderer/src/store/redux';
import type { StorageConnection } from '#/shared/types';
import { DEFAULT_GIT_SETTINGS } from '#/renderer/src/ui/Settings/constants';

export type CollectionModalMode = 'create' | 'create-and-save';
export type CollectionModalTab = 'create' | 'git' | 'import' | 'join';
export type CollectionModalGitPhase = 'repo' | 'auth';

/**
 * Blank git connection draft used when creating a git-backed collection.
 */
function createCollectionModalGitDraft(): StorageConnection & { type: 'git' } {
  return { id: '', name: '', type: 'git', settings: { ...DEFAULT_GIT_SETTINGS } };
}

export interface CollectionModalState {
  mode: CollectionModalMode;
  tab: CollectionModalTab;
  name: string;
  providerId: string;
  shareTokenInput: string;
  submitError: string | null;
  /**
   * Git repository settings entered on the Git tab before the connection is saved.
   */
  gitDraft: StorageConnection & { type: 'git' };
  /**
   * Persisted git connection id after the repo phase saves; used for inline auth.
   */
  gitCreatedConnectionId: string | null;
  /**
   * Whether the Git tab is collecting repo details or authentication.
   */
  gitPhase: CollectionModalGitPhase;
  /**
   * True after the collection row is created so cancel cleanup does not remove the connection.
   */
  gitCollectionCreated: boolean;
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
  /** When set, renders an optional checkbox below the message (e.g. "Do not ask again"). */
  checkboxLabel?: string;
}

/**
 * One theme offered when prompting to switch after plugin activation.
 */
export interface PluginThemePromptTheme {
  id: string;
  title: string;
  type: 'light' | 'dark';
}

/**
 * Plugin theme switch prompt shown immediately after user-enabled activation.
 */
export interface PluginThemePromptState {
  pluginId: string;
  pluginName: string;
  themes: PluginThemePromptTheme[];
}

/**
 * Open plugin modal overlay rendered at the application root.
 */
export interface PluginModalState {
  pluginId: string;
  contributionId: string;
  context?: unknown;
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
 * Collection runner state spanning configuration, progress, and summary.
 */
export interface CollectionRunnerState {
  collectionId: number;
  folderId: number | null;
  collectionName: string;
  folderName: string | null;
  requestId: number | null;
  requestName: string | null;
  /**
   * When set, the runner executes this explicit request list instead of a
   * collection, folder, or single-request target.
   */
  requestIds: number[] | null;
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
  /**
   * When true, state was loaded from an imported run-results file and is read-only.
   */
  imported?: boolean;
  /**
   * Human-readable environment name from export or override selection.
   */
  environmentName?: string | null;

  /**
   * UUID assigned when the run was saved to storage.
   */
  savedRunUuid?: string | null;

  /**
   * Storage connection id when the run was saved.
   */
  savedConnectionId?: string | null;

  /**
   * True when the run was saved to a Team Hub provider.
   */
  savedToTeamHub?: boolean;
}

/**
 * Saved request queued for load after the user confirms discarding unsaved edits.
 */
export interface PendingLoadRequest {
  req: SavedRequest;
  reason: 'settings' | 'dirty-tab';
}

/**
 * Saved markdown document queued for load after the user confirms discarding unsaved edits.
 */
export interface PendingLoadDocument {
  doc: CollectionDocument;
  reason: 'settings' | 'dirty-tab';
}

export type TabGroupModalMode = 'create' | 'rename' | 'clone' | 'createFromSelection';

/**
 * Tab group modal state for create, rename, and clone flows.
 */
export interface TabGroupModalState {
  mode: TabGroupModalMode;
  groupId?: number;
  /**
   * Saved request ids used when creating a tab group from a sidebar selection.
   */
  requestIds?: number[];
  name: string;
  submitError: string | null;
}

export interface ModalsState {
  collectionModal: CollectionModalState | null;
  tabGroupModal: TabGroupModalState | null;
  share: ShareModalState | null;
  pendingLoadRequest: PendingLoadRequest | null;
  pendingLoadDocument: PendingLoadDocument | null;
  quitPrompt: string[] | null;
  about: AboutModalState;
  update: UpdateModalState;
  syncModal: SyncModalState;
  collectionRunner: CollectionRunnerState | null;
  alertModal: AlertModalState | null;
  confirmModal: ConfirmModalState | null;
  pluginThemePrompt: PluginThemePromptState | null;
  pluginModal: PluginModalState | null;
  themePicker: { open: boolean } | null;
  shortcutsReference: { open: boolean } | null;
  acceptTeamHubInvite: { open: boolean } | null;
  actionMenu: { open: boolean } | null;
}

const initialState: ModalsState = {
  collectionModal: null,
  tabGroupModal: null,
  share: null,
  pendingLoadRequest: null,
  pendingLoadDocument: null,
  quitPrompt: null,
  about: { open: false, version: '' },
  update: { open: false, loading: false, result: null, error: null },
  syncModal: { open: false, running: false, providers: [], completed: 0, total: 0 },
  collectionRunner: null,
  alertModal: null,
  confirmModal: null,
  pluginThemePrompt: null,
  pluginModal: null,
  themePicker: null,
  shortcutsReference: null,
  acceptTeamHubInvite: null,
  actionMenu: null
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
        submitError: null,
        gitDraft: createCollectionModalGitDraft(),
        gitCreatedConnectionId: null,
        gitPhase: 'repo',
        gitCollectionCreated: false
      };
    },
    /**
     * Closes the collection modal.
     */
    closeCollectionModal(state) {
      state.collectionModal = null;
    },
    /**
     * Opens the tab group modal for create, rename, or clone.
     */
    openTabGroupModal(
      state,
      action: PayloadAction<{
        mode: TabGroupModalMode;
        groupId?: number;
        requestIds?: number[];
        name?: string;
      }>
    ) {
      state.tabGroupModal = {
        mode: action.payload.mode,
        groupId: action.payload.groupId,
        requestIds: action.payload.requestIds,
        name: action.payload.name ?? '',
        submitError: null
      };
    },
    /**
     * Closes the tab group modal.
     */
    closeTabGroupModal(state) {
      state.tabGroupModal = null;
    },
    /**
     * Updates the tab group name field in the modal.
     */
    setTabGroupModalName(state, action: PayloadAction<string>) {
      if (state.tabGroupModal) {
        state.tabGroupModal.name = action.payload;
        state.tabGroupModal.submitError = null;
      }
    },
    /**
     * Sets an inline submit error on the tab group modal.
     */
    setTabGroupModalSubmitError(state, action: PayloadAction<string | null>) {
      if (state.tabGroupModal) {
        state.tabGroupModal.submitError = action.payload;
      }
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
     * Replaces the git connection draft on the collection modal Git tab.
     */
    setCollectionModalGitDraft(state, action: PayloadAction<StorageConnection & { type: 'git' }>) {
      if (state.collectionModal) {
        state.collectionModal.gitDraft = action.payload;
        state.collectionModal.submitError = null;
      }
    },
    /**
     * Advances or resets the Git tab workflow phase.
     */
    setCollectionModalGitPhase(state, action: PayloadAction<CollectionModalGitPhase>) {
      if (state.collectionModal) {
        state.collectionModal.gitPhase = action.payload;
        state.collectionModal.submitError = null;
      }
    },
    /**
     * Stores the connection id created during the Git tab repo phase.
     */
    setCollectionModalGitCreatedConnectionId(state, action: PayloadAction<string | null>) {
      if (state.collectionModal) {
        state.collectionModal.gitCreatedConnectionId = action.payload;
        state.collectionModal.submitError = null;
      }
    },
    /**
     * Marks that the git-backed collection row was created successfully.
     */
    setCollectionModalGitCollectionCreated(state, action: PayloadAction<boolean>) {
      if (state.collectionModal) {
        state.collectionModal.gitCollectionCreated = action.payload;
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
     * Queues a saved markdown document to load after an unsaved prompt.
     */
    setPendingLoadDocument(state, action: PayloadAction<PendingLoadDocument | null>) {
      state.pendingLoadDocument = action.payload;
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
     * Opens the collection runner for a collection, folder, or single request target.
     */
    openCollectionRunner(
      state,
      action: PayloadAction<{
        collectionId: number;
        folderId?: number | null;
        collectionName: string;
        folderName?: string | null;
        requestId?: number | null;
        requestName?: string | null;
        requestIds?: number[] | null;
        config?: Partial<CollectionRunnerConfig>;
      }>
    ) {
      if (state.collectionRunner?.running) {
        return;
      }
      const config = {
        ...DEFAULT_COLLECTION_RUNNER_CONFIG,
        ...action.payload.config
      };
      state.collectionRunner = {
        collectionId: action.payload.collectionId,
        folderId: action.payload.folderId ?? null,
        collectionName: action.payload.collectionName,
        folderName: action.payload.folderName ?? null,
        requestId: action.payload.requestId ?? null,
        requestName: action.payload.requestName ?? null,
        requestIds: action.payload.requestIds ?? null,
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
     * Clears collection runner state when the runner tab is closed.
     */
    closeCollectionRunner(state) {
      state.collectionRunner = null;
    },
    /**
     * Updates editable runner settings while the runner is not in progress.
     */
    setCollectionRunnerConfig(state, action: PayloadAction<Partial<CollectionRunnerConfig>>) {
      if (
        !state.collectionRunner ||
        (state.collectionRunner.phase !== 'configure' &&
          state.collectionRunner.phase !== 'complete')
      ) {
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
        response?: SendResult | null;
        testResults?: ScriptTestResult[];
        scriptLogs?: string[];
        executionEvents?: ScriptExecutionEvent[];
        scriptError?: string;
        requestUrl?: string;
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
      row.response = action.payload.response;
      row.testResults = action.payload.testResults;
      row.scriptLogs = action.payload.scriptLogs;
      row.executionEvents = action.payload.executionEvents;
      row.scriptError = action.payload.scriptError;
      row.requestUrl = action.payload.requestUrl;
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
     * Replaces runner state with imported run-results for a detached read-only view.
     */
    importCollectionRunnerResults(
      state,
      action: PayloadAction<
        RunResultsExport & {
          collectionId: number;
          requestId: number | null;
          savedRunUuid?: string | null;
          savedConnectionId?: string | null;
          savedToTeamHub?: boolean;
        }
      >
    ) {
      const { collectionId, requestId, savedRunUuid, savedConnectionId, savedToTeamHub, ...data } =
        action.payload;
      const summary = summarizeRunnerResults(data.results);
      state.collectionRunner = {
        collectionId,
        folderId: null,
        collectionName: data.collection?.name ?? 'Imported collection',
        folderName: data.collection?.folderName ?? null,
        requestId,
        requestName: data.request?.name ?? null,
        requestIds: null,
        phase: 'complete',
        delayMs: data.delay,
        stopOnFailure: data.stopOnFailure,
        environmentMode: data.environment.mode,
        environmentId: data.environment.id,
        environmentName: data.environment.name,
        running: false,
        cancelled: false,
        completed: data.results.length,
        total: data.results.length,
        results: data.results,
        summary,
        imported: true,
        savedRunUuid: savedRunUuid ?? null,
        savedConnectionId: savedConnectionId ?? null,
        savedToTeamHub: savedToTeamHub ?? false
      };
    },
    /**
     * Records that the active collection runner run was saved to storage.
     */
    markCollectionRunnerSaved(
      state,
      action: PayloadAction<{
        savedRunUuid: string;
        savedConnectionId: string;
        savedToTeamHub: boolean;
      }>
    ) {
      if (!state.collectionRunner) {
        return;
      }
      state.collectionRunner.savedRunUuid = action.payload.savedRunUuid;
      state.collectionRunner.savedConnectionId = action.payload.savedConnectionId;
      state.collectionRunner.savedToTeamHub = action.payload.savedToTeamHub;
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
    },
    /**
     * Opens the plugin theme switch prompt after user-enabled activation.
     */
    openPluginThemePrompt(state, action: PayloadAction<PluginThemePromptState>) {
      state.pluginThemePrompt = action.payload;
    },
    /**
     * Closes the plugin theme switch prompt without changing the active theme.
     */
    closePluginThemePrompt(state) {
      state.pluginThemePrompt = null;
    },
    /**
     * Opens the first-run theme picker modal.
     */
    openThemePicker(state) {
      state.themePicker = { open: true };
    },
    /**
     * Closes the first-run theme picker modal.
     */
    closeThemePicker(state) {
      state.themePicker = null;
    },
    /**
     * Opens the read-only keyboard shortcuts reference modal.
     */
    openShortcutsReferenceModal(state) {
      state.shortcutsReference = { open: true };
    },
    /**
     * Closes the read-only keyboard shortcuts reference modal.
     */
    closeShortcutsReferenceModal(state) {
      state.shortcutsReference = null;
    },
    /**
     * Opens the modal where users paste a Team Hub invitation deep link.
     */
    openAcceptTeamHubInviteModal(state) {
      state.acceptTeamHubInvite = { open: true };
    },
    /**
     * Closes the Team Hub invitation paste modal.
     */
    closeAcceptTeamHubInviteModal(state) {
      state.acceptTeamHubInvite = null;
    },
    /**
     * Opens the Action menu modal.
     */
    openActionMenuModal(state) {
      state.actionMenu = { open: true };
    },
    /**
     * Closes the Action menu modal.
     */
    closeActionMenuModal(state) {
      state.actionMenu = null;
    },
    /**
     * Opens or closes the host plugin modal overlay webview.
     */
    setPluginModal(state, action: PayloadAction<PluginModalState | null>) {
      state.pluginModal = action.payload;
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
  setCollectionModalGitDraft,
  setCollectionModalGitPhase,
  setCollectionModalGitCreatedConnectionId,
  setCollectionModalGitCollectionCreated,
  openShareModal,
  closeShareModal,
  setShareRecipientKid,
  setShareTrustedKeysLoading,
  setShareTrustedKeys,
  setShareTokenLoading,
  setShareToken,
  setShareTokenError,
  setPendingLoadRequest,
  setPendingLoadDocument,
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
  openCollectionRunner,
  closeCollectionRunner,
  setCollectionRunnerConfig,
  startCollectionRunner,
  setCollectionRunnerRequestRunning,
  appendCollectionRunnerResult,
  skipRemainingCollectionRunnerRequests,
  cancelCollectionRunner,
  finishCollectionRunner,
  importCollectionRunnerResults,
  markCollectionRunnerSaved,
  setAlertModal,
  setConfirmModal,
  openPluginThemePrompt,
  closePluginThemePrompt,
  openThemePicker,
  closeThemePicker,
  openShortcutsReferenceModal,
  closeShortcutsReferenceModal,
  openAcceptTeamHubInviteModal,
  closeAcceptTeamHubInviteModal,
  openActionMenuModal,
  closeActionMenuModal,
  setPluginModal,
  openTabGroupModal,
  closeTabGroupModal,
  setTabGroupModalName,
  setTabGroupModalSubmitError
} = modalsSlice.actions;

/**
 * Returns collection modal state when open.
 */
export const selectCollectionModal = (state: RootState): CollectionModalState | null =>
  state.modals.collectionModal;

/**
 * Returns tab group modal state when open.
 */
export const selectTabGroupModal = (state: RootState): TabGroupModalState | null =>
  state.modals.tabGroupModal;

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
 * Returns the markdown document queued for load after an unsaved prompt, if any.
 */
export const selectPendingLoadDocument = (state: RootState): PendingLoadDocument | null =>
  state.modals.pendingLoadDocument;
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
 * Returns collection runner state when a runner tab is active.
 */
export const selectCollectionRunner = (state: RootState): CollectionRunnerState | null =>
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
/**
 * Returns plugin theme prompt state when open.
 */
export const selectPluginThemePrompt = (state: RootState): PluginThemePromptState | null =>
  state.modals.pluginThemePrompt;
/**
 * Returns open plugin modal overlay state when active.
 */
export const selectPluginModal = (state: RootState): PluginModalState | null =>
  state.modals.pluginModal;

/**
 * Returns first-run theme picker modal state when open.
 */
export const selectThemePicker = (state: RootState): { open: boolean } | null =>
  state.modals.themePicker;

/**
 * Returns read-only keyboard shortcuts reference modal state when open.
 */
export const selectShortcutsReferenceModal = (state: RootState): { open: boolean } | null =>
  state.modals.shortcutsReference;

/**
 * Returns Team Hub invitation paste modal state when open.
 */
export const selectAcceptTeamHubInviteModal = (state: RootState): { open: boolean } | null =>
  state.modals.acceptTeamHubInvite;

/**
 * Returns global search command palette modal state when open.
 */
export const selectActionMenuModal = (state: RootState): { open: boolean } | null =>
  state.modals.actionMenu;

/**
 * Returns whether any Redux-backed modal should block overlay Escape navigation.
 */
export const selectHasBlockingModal = (state: RootState): boolean => {
  const modals = state.modals;
  return (
    modals.collectionModal != null ||
    modals.tabGroupModal != null ||
    modals.share != null ||
    modals.pendingLoadRequest != null ||
    modals.pendingLoadDocument != null ||
    modals.quitPrompt != null ||
    modals.alertModal != null ||
    modals.confirmModal != null ||
    modals.pluginThemePrompt != null ||
    modals.themePicker != null ||
    modals.shortcutsReference != null ||
    modals.acceptTeamHubInvite != null ||
    modals.actionMenu != null ||
    modals.pluginModal != null ||
    modals.about.open ||
    modals.update.open ||
    modals.syncModal.open
  );
};

export default modalsSlice.reducer;
