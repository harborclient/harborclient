import { describe, expect, it } from 'vitest';
import { defaultAuth } from '@harborclient/core/auth';
import type { RootState } from '#/renderer/src/store/redux';
import modalsReducer, {
  appendCollectionRunnerResult,
  cancelCollectionRunner,
  closeAboutModal,
  closeAddLiveServerModal,
  closeCollectionModal,
  closeCollectionRunner,
  closeSaveRequestModal,
  closeShareModal,
  closeSyncModal,
  finishCollectionRunner,
  finishSync,
  importCollectionRunnerResults,
  incrementSyncCompleted,
  openAboutModal,
  openAddLiveServerModal,
  openCollectionModal,
  openCollectionRunner,
  openLiveServerModal,
  openSaveRequestModal,
  openShareModal,
  openSyncModal,
  selectHasBlockingModal,
  setAboutVersion,
  setAddLiveServerModalGitConnectionCommitted,
  setAddLiveServerModalGitCreatedConnectionId,
  setAddLiveServerModalName,
  setAddLiveServerModalProviderId,
  setAddLiveServerModalSubmitError,
  setAddLiveServerModalTab,
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
  setLiveServerModalHeaders,
  setLiveServerModalRoutes,
  setLiveServerModalErrorPages,
  setLiveServerModalSsl,
  setLiveServerModalTab,
  setOpenExternalLinkModal,
  setSyncProviderStatus,
  setSyncProviders,
  skipRemainingCollectionRunnerRequests,
  startCollectionRunner
} from './modalsSlice';

describe('modalsSlice', () => {
  it('starts with all modals closed', () => {
    const state = modalsReducer(undefined, { type: 'unknown' });
    expect(state.collectionModal).toBeNull();
    expect(state.saveRequestModal).toBeNull();
    expect(state.addLiveServerModal).toBeNull();
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

  it('opens and closes the save-request location picker', () => {
    let state = modalsReducer(undefined, openSaveRequestModal({ tabId: 'tab-1' }));
    expect(state.saveRequestModal).toEqual({ tabId: 'tab-1' });
    state = modalsReducer(state, closeSaveRequestModal());
    expect(state.saveRequestModal).toBeNull();
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
      importUrlOpen: false,
      importUrlInput: '',
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

  it('opens and closes the Add Live Server modal', () => {
    let state = modalsReducer(undefined, openAddLiveServerModal());
    expect(state.addLiveServerModal).toEqual({
      tab: 'storage',
      name: '',
      providerId: '',
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
      gitConnectionCommitted: false
    });

    state = modalsReducer(state, setAddLiveServerModalName('Docs'));
    expect(state.addLiveServerModal?.name).toBe('Docs');

    state = modalsReducer(state, setAddLiveServerModalProviderId('conn-1'));
    expect(state.addLiveServerModal?.providerId).toBe('conn-1');
    expect(state.addLiveServerModal?.submitError).toBeNull();

    state = modalsReducer(state, setAddLiveServerModalTab('git'));
    expect(state.addLiveServerModal?.tab).toBe('git');

    state = modalsReducer(state, setAddLiveServerModalSubmitError('Import failed'));
    expect(state.addLiveServerModal?.submitError).toBe('Import failed');

    state = modalsReducer(state, setAddLiveServerModalGitCreatedConnectionId('git-1'));
    expect(state.addLiveServerModal?.gitCreatedConnectionId).toBe('git-1');
    expect(state.addLiveServerModal?.submitError).toBeNull();

    state = modalsReducer(state, setAddLiveServerModalGitConnectionCommitted(true));
    expect(state.addLiveServerModal?.gitConnectionCommitted).toBe(true);

    state = modalsReducer(state, closeAddLiveServerModal());
    expect(state.addLiveServerModal).toBeNull();
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
      protocol: 'http' as const,
      method: 'GET' as const,
      url: 'https://example.com',
      headers: [],
      params: [],
      body: '',
      body_type: 'none' as const,
      body_raw: null,
      body_raw_open: false,
      pre_request_script: '',
      post_request_script: '',
      pre_request_scripts: [],
      post_request_scripts: [],
      comment: '',
      tags: '',
      auth: defaultAuth(),
      userAgent: '',
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
      setAlertModal({
        title: 'Error',
        message: 'Something went wrong',
        actions: [
          {
            kind: 'openCollectionGitSettings',
            label: 'Open Git settings',
            collectionId: 3
          }
        ]
      })
    );
    expect(state.alertModal).toEqual({
      title: 'Error',
      message: 'Something went wrong',
      actions: [
        {
          kind: 'openCollectionGitSettings',
          label: 'Open Git settings',
          collectionId: 3
        }
      ]
    });

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

  it('returns true when the save-request location picker is open', () => {
    const state = modalsReducer(undefined, openSaveRequestModal({ tabId: 'tab-1' }));
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

  it('returns true when the open-external-link modal is open', () => {
    const state = modalsReducer(
      undefined,
      setOpenExternalLinkModal({ url: 'https://example.com/' })
    );
    expect(selectHasBlockingModal(rootWithModals(state))).toBe(true);
  });

  it('returns false when only the live server editor is open', () => {
    const state = modalsReducer(undefined, openLiveServerModal({ mode: 'create' }));
    expect(state.liveServerModal?.tab).toBe('general');
    expect(selectHasBlockingModal(rootWithModals(state))).toBe(false);
  });

  it('defaults General tab fields when opening a create live server modal', () => {
    const state = modalsReducer(undefined, openLiveServerModal({ mode: 'create' }));
    expect(state.liveServerModal).toMatchObject({
      openPath: '/',
      openPathOnStartup: true,
      rememberLastUrl: false,
      lastOpenedPath: null,
      indexFiles: 'index.html',
      host: '127.0.0.1',
      headers: [],
      routes: [],
      errorPages: [],
      proxies: [],
      ssl: { enabled: false, certPath: '', keyPath: '' },
      runCommand: '',
      runtimeId: '',
      runCommandEnv: [],
      runCommandEnabled: false,
      restartOnCrash: false,
      urlVariable: ''
    });
    expect(state.liveServerModal?.cors).toMatchObject({
      exposedHeaders: '',
      maxAge: ''
    });
  });

  it('loads General tab fields when opening an edit live server modal', () => {
    const state = modalsReducer(
      undefined,
      openLiveServerModal({
        mode: 'edit',
        savedId: 7,
        openPath: '/docs/',
        openPathOnStartup: false,
        rememberLastUrl: true,
        lastOpenedPath: '/docs/guide.html',
        runCommand: '/usr/bin/node ./server.js',
        runtimeId: 'runtime-node-22',
        runCommandEnv: [{ key: 'NODE_ENV', value: 'dev', enabled: true }],
        runCommandEnabled: true,
        restartOnCrash: true,
        urlVariable: 'server_url',
        indexFiles: 'index.html, app.html',
        host: '0.0.0.0',
        headers: [{ name: 'Cache-Control', value: 'no-store', enabled: true }],
        routes: [{ match: '*', target: 'index.html', enabled: true }],
        errorPages: [],
        proxies: [
          {
            path: '/api',
            target: 'http://127.0.0.1:3000',
            stripPath: true,
            enabled: true
          }
        ],
        ssl: {
          enabled: true,
          certPath: '/tmp/cert.pem',
          keyPath: '/tmp/key.pem'
        }
      })
    );
    expect(state.liveServerModal).toMatchObject({
      savedId: 7,
      openPath: '/docs/',
      openPathOnStartup: false,
      rememberLastUrl: true,
      lastOpenedPath: '/docs/guide.html',
      indexFiles: 'index.html, app.html',
      host: '0.0.0.0',
      headers: [{ name: 'Cache-Control', value: 'no-store', enabled: true }],
      routes: [{ match: '*', target: 'index.html', enabled: true }],
      errorPages: [],
      proxies: [
        {
          path: '/api',
          target: 'http://127.0.0.1:3000',
          stripPath: true,
          enabled: true
        }
      ],
      ssl: {
        enabled: true,
        certPath: '/tmp/cert.pem',
        keyPath: '/tmp/key.pem'
      },
      runCommand: '/usr/bin/node ./server.js',
      runtimeId: 'runtime-node-22',
      runCommandEnv: [{ key: 'NODE_ENV', value: 'dev', enabled: true }],
      runCommandEnabled: true,
      restartOnCrash: true,
      urlVariable: 'server_url'
    });
  });

  it('switches the live server modal to the Headers tab', () => {
    const opened = modalsReducer(undefined, openLiveServerModal({ mode: 'create' }));
    const state = modalsReducer(opened, setLiveServerModalTab('headers'));
    expect(state.liveServerModal?.tab).toBe('headers');
  });

  it('switches the live server modal to the Routing tab', () => {
    const opened = modalsReducer(undefined, openLiveServerModal({ mode: 'create' }));
    const state = modalsReducer(opened, setLiveServerModalTab('routing'));
    expect(state.liveServerModal?.tab).toBe('routing');
  });

  it('switches the live server modal to the Proxy tab', () => {
    const opened = modalsReducer(undefined, openLiveServerModal({ mode: 'create' }));
    const state = modalsReducer(opened, setLiveServerModalTab('proxy'));
    expect(state.liveServerModal?.tab).toBe('proxy');
  });

  it('switches the live server modal to the Run tab', () => {
    const opened = modalsReducer(undefined, openLiveServerModal({ mode: 'create' }));
    const state = modalsReducer(opened, setLiveServerModalTab('run'));
    expect(state.liveServerModal?.tab).toBe('run');
  });

  it('switches the live server modal to the SSL tab', () => {
    const opened = modalsReducer(undefined, openLiveServerModal({ mode: 'create' }));
    const state = modalsReducer(opened, setLiveServerModalTab('ssl'));
    expect(state.liveServerModal?.tab).toBe('ssl');
  });

  it('updates live server header rows via the Headers setter', () => {
    const opened = modalsReducer(undefined, openLiveServerModal({ mode: 'create' }));
    const headers = [{ name: 'X-Frame-Options', value: 'DENY', enabled: false }];
    const state = modalsReducer(opened, setLiveServerModalHeaders(headers));
    expect(state.liveServerModal?.headers).toEqual(headers);
  });

  it('updates live server routing rules via the Routing setter', () => {
    const opened = modalsReducer(undefined, openLiveServerModal({ mode: 'create' }));
    const routes = [{ match: '*', target: 'index.html', enabled: true }];
    const state = modalsReducer(opened, setLiveServerModalRoutes(routes));
    expect(state.liveServerModal?.routes).toEqual(routes);
  });

  it('updates live server error pages via the Routing setter', () => {
    const opened = modalsReducer(undefined, openLiveServerModal({ mode: 'create' }));
    const errorPages = [{ code: '404', path: '404.html', enabled: true }];
    const state = modalsReducer(opened, setLiveServerModalErrorPages(errorPages));
    expect(state.liveServerModal?.errorPages).toEqual(errorPages);
  });

  it('updates live server SSL settings via the SSL setter', () => {
    const opened = modalsReducer(undefined, openLiveServerModal({ mode: 'create' }));
    const ssl = { enabled: true, certPath: '/certs/server.crt', keyPath: '/certs/server.key' };
    const state = modalsReducer(opened, setLiveServerModalSsl(ssl));
    expect(state.liveServerModal?.ssl).toEqual(ssl);
  });
});
