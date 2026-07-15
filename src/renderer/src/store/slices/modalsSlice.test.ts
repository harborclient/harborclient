import { describe, expect, it } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import type { RootState } from '#/renderer/src/store/redux';
import modalsReducer, {
  appendCollectionRunnerResult,
  cancelCollectionRunner,
  closeAboutModal,
  closeCollectionModal,
  closeCollectionRunner,
  closeShareModal,
  closeSyncModal,
  finishCollectionRunner,
  finishSync,
  importCollectionRunnerResults,
  incrementSyncCompleted,
  openAboutModal,
  openCollectionModal,
  openCollectionRunner,
  openShareModal,
  openSyncModal,
  selectHasBlockingModal,
  setAboutVersion,
  setCollectionModalShareTokenInput,
  setCollectionModalName,
  setCollectionModalTab,
  setCollectionModalSubmitError,
  setCollectionRunnerConfig,
  setShareRecipientKid,
  setPendingLoadRequest,
  setQuitPrompt,
  setAlertModal,
  setConfirmModal,
  setHostedModal,
  setSyncProviderStatus,
  setSyncProviders,
  skipRemainingCollectionRunnerRequests,
  startCollectionRunner
} from './modalsSlice';

describe('modalsSlice', () => {
  it('starts with all modals closed', () => {
    const state = modalsReducer(undefined, { type: 'unknown' });
    expect(state.collectionModal).toBeNull();
    expect(state.share).toBeNull();
    expect(state.pendingLoadRequest).toBeNull();
    expect(state.quitPrompt).toBeNull();
    expect(state.about).toEqual({ open: false, version: '' });
    expect(state.syncModal).toEqual({
      open: false,
      running: false,
      providers: [],
      completed: 0,
      total: 0
    });
    expect(state.alertModal).toBeNull();
    expect(state.confirmModal).toBeNull();
    expect(state.collectionRunner).toBeNull();
  });

  it('opens and closes the collection modal', () => {
    let state = modalsReducer(
      undefined,
      openCollectionModal({ mode: 'create-and-save', tab: 'join' })
    );
    expect(state.collectionModal).toEqual({
      mode: 'create-and-save',
      tab: 'join',
      name: '',
      providerId: '',
      shareTokenInput: '',
      submitError: null,
      gitDraft: {
        id: '',
        name: '',
        type: 'git',
        settings: {
          repoPath: '',
          url: '',
          branch: 'main',
          subdir: '',
          auth: { kind: 'pat', username: 'token' }
        }
      },
      gitCreatedConnectionId: null,
      gitCollectionCreated: false
    });

    state = modalsReducer(state, setCollectionModalName('My API'));
    expect(state.collectionModal?.name).toBe('My API');

    state = modalsReducer(state, setCollectionModalTab('import'));
    expect(state.collectionModal?.tab).toBe('import');
    expect(state.collectionModal?.submitError).toBeNull();

    state = modalsReducer(state, setCollectionModalSubmitError('Create failed'));
    expect(state.collectionModal?.submitError).toBe('Create failed');

    state = modalsReducer(state, setCollectionModalShareTokenInput('token'));
    expect(state.collectionModal?.shareTokenInput).toBe('token');
    expect(state.collectionModal?.submitError).toBeNull();

    state = modalsReducer(state, closeCollectionModal());
    expect(state.collectionModal).toBeNull();
  });

  it('opens share modal and clears token when recipient changes', () => {
    let state = modalsReducer(
      undefined,
      openShareModal({ collectionId: 1, collectionName: 'Demo' })
    );
    expect(state.share?.collectionId).toBe(1);
    expect(state.share?.trustedKeysLoading).toBe(true);

    state = modalsReducer(state, setShareRecipientKid('kid-1'));
    expect(state.share?.recipientKid).toBe('kid-1');

    state = modalsReducer(state, closeShareModal());
    expect(state.share).toBeNull();
  });

  it('tracks pending load and quit prompts', () => {
    const request = {
      id: 1,
      uuid: '',
      collection_id: 2,
      folder_id: null,
      name: 'Get users',
      method: 'GET' as const,
      url: 'https://example.com',
      headers: [],
      params: [],
      body: '',
      body_type: 'none' as const,
      pre_request_script: '',
      post_request_script: '',
      pre_request_scripts: [],
      post_request_scripts: [],
      comment: '',
      tags: '',
      auth: defaultAuth(),
      sort_order: 0,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z'
    };

    let state = modalsReducer(
      undefined,
      setPendingLoadRequest({ req: request, reason: 'settings' })
    );
    expect(state.pendingLoadRequest).toEqual({ req: request, reason: 'settings' });

    state = modalsReducer(state, setQuitPrompt(['Draft A', 'Draft B']));
    expect(state.quitPrompt).toEqual(['Draft A', 'Draft B']);
  });

  it('opens about modal and stores version', () => {
    let state = modalsReducer(undefined, openAboutModal());
    expect(state.about.open).toBe(true);

    state = modalsReducer(state, setAboutVersion('1.2.3'));
    expect(state.about.version).toBe('1.2.3');

    state = modalsReducer(state, closeAboutModal());
    expect(state.about).toEqual({ open: false, version: '' });
  });

  it('opens and closes alert and confirm modals', () => {
    let state = modalsReducer(
      undefined,
      setAlertModal({ title: 'Error', message: 'Something went wrong' })
    );
    expect(state.alertModal).toEqual({ title: 'Error', message: 'Something went wrong' });

    state = modalsReducer(state, setAlertModal(null));
    expect(state.alertModal).toBeNull();

    state = modalsReducer(
      state,
      setConfirmModal({
        title: 'Delete item',
        message: 'Are you sure?',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        variant: 'danger'
      })
    );
    expect(state.confirmModal?.variant).toBe('danger');

    state = modalsReducer(state, setConfirmModal(null));
    expect(state.confirmModal).toBeNull();
  });

  it('tracks sync modal progress and summary state', () => {
    let state = modalsReducer(undefined, openSyncModal());
    expect(state.syncModal).toEqual({
      open: true,
      running: true,
      providers: [],
      completed: 0,
      total: 0
    });

    state = modalsReducer(
      state,
      setSyncProviders([
        {
          id: 'db-1',
          name: 'Local SQLite',
          kind: 'database',
          status: 'pending',
          error: null
        },
        {
          id: 'hub-1',
          name: 'Team Hub',
          kind: 'team-hub',
          status: 'pending',
          error: null
        }
      ])
    );
    expect(state.syncModal.total).toBe(2);

    state = modalsReducer(state, setSyncProviderStatus({ id: 'db-1', status: 'syncing' }));
    expect(state.syncModal.providers[0]?.status).toBe('syncing');

    state = modalsReducer(
      state,
      setSyncProviderStatus({ id: 'db-1', status: 'success', error: null })
    );
    state = modalsReducer(state, incrementSyncCompleted());
    expect(state.syncModal.completed).toBe(1);

    state = modalsReducer(
      state,
      setSyncProviderStatus({ id: 'hub-1', status: 'error', error: 'Connection refused' })
    );
    state = modalsReducer(state, incrementSyncCompleted());
    state = modalsReducer(state, finishSync());
    expect(state.syncModal.running).toBe(false);
    expect(state.syncModal.providers[1]?.error).toBe('Connection refused');

    state = modalsReducer(state, closeSyncModal());
    expect(state.syncModal.open).toBe(false);
  });

  it('tracks collection runner configuration, progress, and summary', () => {
    let state = modalsReducer(
      undefined,
      openCollectionRunner({
        collectionId: 1,
        collectionName: 'Demo API',
        config: { delayMs: 100, stopOnFailure: true }
      })
    );
    expect(state.collectionRunner?.phase).toBe('configure');
    expect(state.collectionRunner?.delayMs).toBe(100);

    state = modalsReducer(
      state,
      setCollectionRunnerConfig({ environmentMode: 'override', environmentId: 3 })
    );
    expect(state.collectionRunner?.environmentMode).toBe('override');
    expect(state.collectionRunner?.environmentId).toBe(3);

    state = modalsReducer(
      state,
      startCollectionRunner({
        results: [
          {
            requestId: 10,
            requestName: 'Health',
            requestMethod: 'GET',
            status: 'pending',
            testsPassed: 0,
            testsFailed: 0
          }
        ]
      })
    );
    expect(state.collectionRunner?.phase).toBe('running');
    expect(state.collectionRunner?.total).toBe(1);

    state = modalsReducer(
      state,
      appendCollectionRunnerResult({
        requestId: 10,
        status: 'passed',
        httpStatus: 200,
        testsPassed: 1,
        testsFailed: 0
      })
    );
    expect(state.collectionRunner?.summary.passed).toBe(1);

    state = modalsReducer(state, finishCollectionRunner());
    expect(state.collectionRunner?.phase).toBe('complete');

    state = modalsReducer(state, cancelCollectionRunner());
    state = modalsReducer(state, skipRemainingCollectionRunnerRequests());
    state = modalsReducer(state, closeCollectionRunner());
    expect(state.collectionRunner).toBeNull();
  });

  it('stores request scope when opening the collection runner for one request', () => {
    const state = modalsReducer(
      undefined,
      openCollectionRunner({
        collectionId: 1,
        collectionName: 'Demo API',
        requestId: 42,
        requestName: 'Health'
      })
    );
    expect(state.collectionRunner?.requestId).toBe(42);
    expect(state.collectionRunner?.requestName).toBe('Health');
    expect(state.collectionRunner?.folderId).toBeNull();
    expect(state.collectionRunner?.requestIds).toBeNull();
  });

  it('stores explicit request ids when opening a selection run', () => {
    const state = modalsReducer(
      undefined,
      openCollectionRunner({
        collectionId: 0,
        collectionName: 'Selected requests',
        requestIds: [10, 20, 30]
      })
    );
    expect(state.collectionRunner?.requestIds).toEqual([10, 20, 30]);
    expect(state.collectionRunner?.requestId).toBeNull();
  });

  it('allows config updates in the complete phase', () => {
    let state = modalsReducer(
      undefined,
      openCollectionRunner({ collectionId: 1, collectionName: 'Demo API' })
    );
    state = modalsReducer(
      state,
      startCollectionRunner({
        results: [
          {
            requestId: 10,
            requestName: 'Health',
            requestMethod: 'GET',
            status: 'pending',
            testsPassed: 0,
            testsFailed: 0
          }
        ]
      })
    );
    state = modalsReducer(state, finishCollectionRunner());
    state = modalsReducer(state, setCollectionRunnerConfig({ delayMs: 250 }));

    expect(state.collectionRunner?.phase).toBe('complete');
    expect(state.collectionRunner?.delayMs).toBe(250);
  });

  it('does not retarget the runner while a run is in progress', () => {
    let state = modalsReducer(
      undefined,
      openCollectionRunner({ collectionId: 1, collectionName: 'First' })
    );
    state = modalsReducer(
      state,
      startCollectionRunner({
        results: [
          {
            requestId: 10,
            requestName: 'Health',
            requestMethod: 'GET',
            status: 'pending',
            testsPassed: 0,
            testsFailed: 0
          }
        ]
      })
    );
    state = modalsReducer(
      state,
      openCollectionRunner({ collectionId: 2, collectionName: 'Second' })
    );

    expect(state.collectionRunner?.collectionId).toBe(1);
    expect(state.collectionRunner?.collectionName).toBe('First');
    expect(state.collectionRunner?.running).toBe(true);
  });

  it('hydrates imported run results into a detached read-only runner view', () => {
    const state = modalsReducer(
      undefined,
      importCollectionRunnerResults({
        harborclientVersion: 1,
        harborclientExport: 'collection-run-results',
        delay: 250,
        stopOnFailure: true,
        environment: { mode: 'override', id: 3, name: 'Staging' },
        collection: {
          uuid: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Demo API'
        },
        results: [
          {
            requestId: 10,
            requestName: 'Health',
            requestMethod: 'GET',
            status: 'passed',
            testsPassed: 1,
            testsFailed: 0
          },
          {
            requestId: 11,
            requestName: 'Users',
            requestMethod: 'GET',
            status: 'failed',
            testsPassed: 0,
            testsFailed: 1
          }
        ],
        collectionId: 0,
        requestId: null
      })
    );

    expect(state.collectionRunner?.imported).toBe(true);
    expect(state.collectionRunner?.phase).toBe('complete');
    expect(state.collectionRunner?.running).toBe(false);
    expect(state.collectionRunner?.delayMs).toBe(250);
    expect(state.collectionRunner?.environmentName).toBe('Staging');
    expect(state.collectionRunner?.summary).toEqual({ passed: 1, failed: 1, skipped: 0 });
    expect(state.collectionRunner?.completed).toBe(2);
  });

  it('opens and closes the plugin modal overlay', () => {
    let state = modalsReducer(
      undefined,
      setHostedModal({
        pluginId: 'com.test.plugin',
        contributionId: 'editor',
        context: { editingId: 'abc' }
      })
    );
    expect(state.hostedModal).toEqual({
      pluginId: 'com.test.plugin',
      contributionId: 'editor',
      context: { editingId: 'abc' }
    });

    state = modalsReducer(state, setHostedModal(null));
    expect(state.hostedModal).toBeNull();
  });
});

describe('selectHasBlockingModal', () => {
  /**
   * Builds a minimal root state object for modal selector tests.
   *
   * @param modals - Modal slice state under test.
   * @returns Root state stub containing only the modals slice.
   */
  function rootWithModals(modals: ReturnType<typeof modalsReducer>): RootState {
    return { modals } as RootState;
  }

  it('returns false when no modals are open', () => {
    const state = modalsReducer(undefined, { type: 'unknown' });
    expect(selectHasBlockingModal(rootWithModals(state))).toBe(false);
  });

  it('returns true when the collection modal is open', () => {
    const state = modalsReducer(undefined, openCollectionModal({ mode: 'create' }));
    expect(selectHasBlockingModal(rootWithModals(state))).toBe(true);
  });

  it('returns true when the quit prompt is open', () => {
    const state = modalsReducer(undefined, setQuitPrompt(['Request A']));
    expect(selectHasBlockingModal(rootWithModals(state))).toBe(true);
  });

  it('returns true when the about modal is open', () => {
    const state = modalsReducer(undefined, openAboutModal());
    expect(selectHasBlockingModal(rootWithModals(state))).toBe(true);
  });
});
