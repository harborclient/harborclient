import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import { createInlineScriptRef } from '#/shared/scriptRefs';
import { asRequestTab, isRequestTab } from '#/renderer/src/store/drafts';
import { scriptEditorUiStorageKey } from '#/renderer/src/hooks/usePersistedScriptEditorUiState';
import type { SaveRequestInput, SavedRequest } from '#/shared/types';

// react-hot-toast pulls in the DOM at import time; stub it for the Node test env.
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn(), loading: vi.fn(), dismiss: vi.fn() }
}));

/**
 * Minimal in-memory localStorage mock so the store's persistence subscriber can run
 * in the Node test environment without a real DOM.
 */
function createLocalStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    }
  };
}

const saveRequestMock = vi.fn<(input: SaveRequestInput) => Promise<SavedRequest>>();
const listRequestsMock = vi.fn<(collectionId: number) => Promise<SavedRequest[]>>();
const listFoldersMock = vi.fn<(collectionId: number) => Promise<unknown[]>>();
const cancelRequestMock = vi.fn<(requestId: string) => Promise<void>>();

/**
 * Builds a saved request matching a save input so the thunk can update tab state.
 */
function savedFrom(input: SaveRequestInput): SavedRequest {
  return {
    id: input.id ?? 999,
    uuid: input.uuid ?? '',
    collection_id: input.collection_id,
    folder_id: input.folder_id ?? null,
    name: input.name,
    method: input.method,
    url: input.url,
    headers: input.headers,
    params: input.params,
    auth: input.auth,
    body: input.body,
    body_type: input.body_type,
    pre_request_script: input.pre_request_script ?? '',
    post_request_script: input.post_request_script ?? '',
    pre_request_scripts: input.pre_request_scripts ?? [],
    post_request_scripts: input.post_request_scripts ?? [],
    comment: input.comment ?? '',
    tags: input.tags ?? '',
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z'
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', createLocalStorageMock());
  vi.stubGlobal('window', {
    api: {
      saveRequest: saveRequestMock,
      listRequests: listRequestsMock,
      listFolders: listFoldersMock,
      cancelRequest: cancelRequestMock
    }
  });
  saveRequestMock.mockReset();
  saveRequestMock.mockImplementation((input) => Promise.resolve(savedFrom(input)));
  listRequestsMock.mockReset();
  listRequestsMock.mockResolvedValue([]);
  listFoldersMock.mockReset();
  listFoldersMock.mockResolvedValue([]);
  cancelRequestMock.mockReset();
  cancelRequestMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('saveRequest folder handling', () => {
  it('keeps folder_id when updating a request in its own collection', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const { openTabWithDraft } = await import('#/renderer/src/store/slices/tabsSlice');
    const { saveRequest } = await import('#/renderer/src/store/thunks/requests');

    store.dispatch(
      openTabWithDraft({
        id: 5,
        collection_id: 1,
        folder_id: 10,
        name: 'In Folder',
        method: 'GET',
        url: 'https://example.com',
        headers: [],
        params: [],
        body: '',
        body_type: 'none',
        pre_request_script: '',
        post_request_script: '',
        pre_request_scripts: [],
        post_request_scripts: [],
        comment: '',
        tags: '',
        auth: defaultAuth()
      })
    );

    await store.dispatch(saveRequest(1));

    expect(saveRequestMock).toHaveBeenCalledTimes(1);
    const input = saveRequestMock.mock.calls[0][0];
    expect(input.id).toBe(5);
    expect(input.collection_id).toBe(1);
    expect(input.folder_id).toBe(10);
  });

  it('drops folder_id when saving a copy into a different collection', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const { openTabWithDraft } = await import('#/renderer/src/store/slices/tabsSlice');
    const { saveRequest } = await import('#/renderer/src/store/thunks/requests');

    store.dispatch(
      openTabWithDraft({
        id: 5,
        collection_id: 1,
        folder_id: 10,
        name: 'In Folder',
        method: 'GET',
        url: 'https://example.com',
        headers: [],
        params: [],
        body: '',
        body_type: 'none',
        pre_request_script: '',
        post_request_script: '',
        pre_request_scripts: [],
        post_request_scripts: [],
        comment: '',
        tags: '',
        auth: defaultAuth()
      })
    );

    await store.dispatch(saveRequest(2));

    expect(saveRequestMock).toHaveBeenCalledTimes(1);
    const input = saveRequestMock.mock.calls[0][0];
    expect(input.id).toBeUndefined();
    expect(input.collection_id).toBe(2);
    expect(input.folder_id).toBeNull();
  });

  it('prefers sidebar folder_id over stale tab draft when saving after a sidebar move', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const { setRequestsForCollection } =
      await import('#/renderer/src/store/slices/collectionsSlice');
    const { openTabWithDraft } = await import('#/renderer/src/store/slices/tabsSlice');
    const { saveRequest } = await import('#/renderer/src/store/thunks/requests');

    store.dispatch(
      openTabWithDraft({
        id: 5,
        collection_id: 1,
        folder_id: 10,
        name: 'Moved Request',
        method: 'GET',
        url: 'https://example.com',
        headers: [],
        params: [],
        body: '',
        body_type: 'none',
        pre_request_script: '',
        post_request_script: '',
        pre_request_scripts: [],
        post_request_scripts: [],
        comment: '',
        tags: '',
        auth: defaultAuth()
      })
    );

    store.dispatch(
      setRequestsForCollection({
        collectionId: 1,
        requests: [
          {
            ...savedFrom({
              id: 5,
              collection_id: 1,
              folder_id: 20,
              name: 'Moved Request',
              method: 'GET',
              url: 'https://example.com',
              headers: [],
              params: [],
              body: '',
              body_type: 'none',
              pre_request_script: '',
              post_request_script: '',
              comment: '',
              tags: '',
              auth: defaultAuth()
            })
          }
        ]
      })
    );

    await store.dispatch(saveRequest(1));

    expect(saveRequestMock).toHaveBeenCalledTimes(1);
    const input = saveRequestMock.mock.calls[0][0];
    expect(input.folder_id).toBe(20);
  });
});

describe('saveRequest script lists', () => {
  it('persists every pre-request script reference in the save payload', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const { openTabWithDraft } = await import('#/renderer/src/store/slices/tabsSlice');
    const { saveRequest } = await import('#/renderer/src/store/thunks/requests');

    const first = createInlineScriptRef('console.log("one");', 'First');
    const second = createInlineScriptRef('', 'Unnamed script...');

    store.dispatch(
      openTabWithDraft({
        id: 9,
        collection_id: 1,
        name: 'Scripted',
        method: 'GET',
        url: 'https://example.com',
        headers: [],
        params: [],
        body: '',
        body_type: 'none',
        pre_request_script: 'console.log("one");',
        post_request_script: '',
        pre_request_scripts: [first, second],
        post_request_scripts: [],
        comment: '',
        tags: '',
        auth: defaultAuth()
      })
    );

    await store.dispatch(saveRequest(1));

    const input = saveRequestMock.mock.calls[0]?.[0];
    expect(input?.pre_request_scripts).toHaveLength(2);
    expect(input?.pre_request_scripts?.map((script) => script.name)).toEqual([
      'First',
      'Unnamed script...'
    ]);
    expect(input?.pre_request_script).toBe('console.log("one");');
  });

  it('auto-names unnamed scripts from the first source line when saving', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const { openTabWithDraft } = await import('#/renderer/src/store/slices/tabsSlice');
    const { saveRequest } = await import('#/renderer/src/store/thunks/requests');

    const unnamedWithCode = createInlineScriptRef(
      'console.log("hello world");',
      'Unnamed script...'
    );

    store.dispatch(
      openTabWithDraft({
        id: 9,
        collection_id: 1,
        name: 'Scripted',
        method: 'GET',
        url: 'https://example.com',
        headers: [],
        params: [],
        body: '',
        body_type: 'none',
        pre_request_script: '',
        post_request_script: '',
        pre_request_scripts: [unnamedWithCode],
        post_request_scripts: [],
        comment: '',
        tags: '',
        auth: defaultAuth()
      })
    );

    await store.dispatch(saveRequest(1));

    const input = saveRequestMock.mock.calls.at(-1)?.[0];
    expect(input?.pre_request_scripts?.[0]?.name).toBe('console.log("hello world"');
  });

  it('preserves expanded script UI state and migrates editor height keys after save', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const { openTabWithDraft } = await import('#/renderer/src/store/slices/tabsSlice');
    const { saveRequest } = await import('#/renderer/src/store/thunks/requests');

    const expandedScript = {
      ...createInlineScriptRef('console.log("keep open");'),
      expanded: true
    };
    localStorage.setItem(
      scriptEditorUiStorageKey(expandedScript.id),
      JSON.stringify({ heightPx: 300 })
    );

    store.dispatch(
      openTabWithDraft({
        id: 42,
        collection_id: 1,
        name: 'Expanded script save',
        method: 'GET',
        url: 'https://example.com',
        headers: [],
        params: [],
        body: '',
        body_type: 'none',
        pre_request_script: 'console.log("keep open");',
        post_request_script: '',
        pre_request_scripts: [expandedScript],
        post_request_scripts: [],
        comment: '',
        tags: '',
        auth: defaultAuth()
      })
    );

    saveRequestMock.mockImplementation(async (input) => {
      const regenerated = createInlineScriptRef('console.log("keep open");');
      return savedFrom({
        ...input,
        id: 42,
        pre_request_scripts: [regenerated],
        pre_request_script: 'console.log("keep open");'
      });
    });

    await store.dispatch(saveRequest(1));

    const activeTabId = store.getState().tabs.activeTabId;
    const tab = asRequestTab(
      store.getState().tabs.tabs.find((entry) => entry.tabId === activeTabId)
    );
    const savedScript = tab.draft.pre_request_scripts[0];

    expect(savedScript?.expanded).toBe(true);
    expect(savedScript?.id).not.toBe(expandedScript.id);
    expect(localStorage.getItem(scriptEditorUiStorageKey(expandedScript.id))).toBeNull();
    expect(JSON.parse(localStorage.getItem(scriptEditorUiStorageKey(savedScript!.id))!)).toEqual({
      heightPx: 300
    });
  });
});

describe('saveAllDirtyRequests', () => {
  /**
   * Opens a saved request tab and edits the draft so it is dirty.
   *
   * @param store - Redux store under test.
   * @param draft - Saved request draft to open.
   * @param editedUrl - URL applied to mark the tab dirty.
   */
  async function openDirtyTab(
    store: Awaited<typeof import('#/renderer/src/store/redux')>['store'],
    draft: Parameters<
      Awaited<typeof import('#/renderer/src/store/slices/tabsSlice')>['openTabWithDraft']
    >[0],
    editedUrl = 'https://example.com/edited'
  ): Promise<void> {
    const { openTabWithDraft, setActiveDraft } =
      await import('#/renderer/src/store/slices/tabsSlice');
    store.dispatch(openTabWithDraft(draft));
    const activeTab = store
      .getState()
      .tabs.tabs.find((tab) => tab.tabId === store.getState().tabs.activeTabId);
    if (!activeTab || !isRequestTab(activeTab)) throw new Error('expected active tab');
    store.dispatch(setActiveDraft({ ...activeTab.draft, url: editedUrl }));
  }

  const baseDraft = {
    collection_id: 1,
    name: 'Request',
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
    auth: defaultAuth()
  };

  it('returns savedCount 0 when no tabs are dirty in the collection', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const { openTabWithDraft } = await import('#/renderer/src/store/slices/tabsSlice');
    const { saveAllDirtyRequests } = await import('#/renderer/src/store/thunks/requests');

    store.dispatch(openTabWithDraft({ ...baseDraft, id: 1 }));

    const result = await store.dispatch(saveAllDirtyRequests({ collectionId: 1 })).unwrap();

    expect(result).toEqual({ savedCount: 0 });
    expect(saveRequestMock).not.toHaveBeenCalled();
  });

  it('saves every dirty tab in the collection and skips clean tabs', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const { openTabWithDraft } = await import('#/renderer/src/store/slices/tabsSlice');
    const { saveAllDirtyRequests } = await import('#/renderer/src/store/thunks/requests');

    store.dispatch(openTabWithDraft({ ...baseDraft, id: 1 }));
    await openDirtyTab(store, { ...baseDraft, id: 2, folder_id: 5 }, 'https://example.com/a');
    await openDirtyTab(store, { ...baseDraft, id: 3 }, 'https://example.com/b');

    const result = await store.dispatch(saveAllDirtyRequests({ collectionId: 1 })).unwrap();

    expect(result).toEqual({ savedCount: 2 });
    expect(saveRequestMock).toHaveBeenCalledTimes(2);
    expect(listFoldersMock).toHaveBeenCalledWith(1);
    expect(listRequestsMock).toHaveBeenCalledWith(1);
  });

  it('saves only dirty tabs in the requested folder', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const { saveAllDirtyRequests } = await import('#/renderer/src/store/thunks/requests');

    await openDirtyTab(store, { ...baseDraft, id: 2, folder_id: 5 }, 'https://example.com/folder');
    await openDirtyTab(store, { ...baseDraft, id: 3, folder_id: null }, 'https://example.com/root');

    const result = await store
      .dispatch(saveAllDirtyRequests({ collectionId: 1, folderId: 5 }))
      .unwrap();

    expect(result).toEqual({ savedCount: 1 });
    expect(saveRequestMock).toHaveBeenCalledTimes(1);
    expect(saveRequestMock.mock.calls[0]?.[0].id).toBe(2);
    expect(saveRequestMock.mock.calls[0]?.[0].folder_id).toBe(5);
  });
});

/**
 * Builds a saved request fixture for requestLoadRequest tests.
 *
 * @param overrides - Partial fields to override defaults.
 * @returns Saved request suitable for thunk dispatch.
 */
function sampleSaved(overrides: Partial<SavedRequest> = {}): SavedRequest {
  return {
    id: 1,
    uuid: '',
    collection_id: 10,
    folder_id: null,
    name: 'Get users',
    method: 'GET',
    url: 'https://example.com/users',
    headers: [],
    params: [],
    auth: defaultAuth(),
    body: '',
    body_type: 'none',
    pre_request_script: '',
    post_request_script: '',
    pre_request_scripts: [],
    post_request_scripts: [],
    comment: '',
    tags: '',
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

describe('requestLoadRequest', () => {
  /**
   * Clears modal state that can leak between tests sharing the singleton store.
   */
  async function resetPendingLoadRequest(
    store: Awaited<typeof import('#/renderer/src/store/redux')>['store']
  ): Promise<void> {
    const { setPendingLoadRequest } = await import('#/renderer/src/store/slices/modalsSlice');
    store.dispatch(setPendingLoadRequest(null));
  }

  /**
   * Opens a saved request tab and edits the draft so it is dirty.
   *
   * @param store - Redux store under test.
   * @param draft - Saved request draft to open.
   */
  async function openDirtySavedTab(
    store: Awaited<typeof import('#/renderer/src/store/redux')>['store'],
    draft: Parameters<
      Awaited<typeof import('#/renderer/src/store/slices/tabsSlice')>['openTabWithDraft']
    >[0]
  ): Promise<void> {
    const { openTabWithDraft, setActiveDraft } =
      await import('#/renderer/src/store/slices/tabsSlice');
    store.dispatch(openTabWithDraft(draft));
    const activeTab = store
      .getState()
      .tabs.tabs.find((tab) => tab.tabId === store.getState().tabs.activeTabId);
    if (!activeTab || !isRequestTab(activeTab)) throw new Error('expected active tab');
    store.dispatch(setActiveDraft({ ...activeTab.draft, url: 'https://example.com/edited' }));
  }

  it('prompts when reopening a dirty tab for the same saved request', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const { requestLoadRequest } = await import('#/renderer/src/store/thunks/requests');
    await resetPendingLoadRequest(store);
    const req = sampleSaved({ id: 101 });

    await openDirtySavedTab(store, {
      id: 101,
      collection_id: 10,
      folder_id: null,
      name: 'Get users',
      method: 'GET',
      url: 'https://example.com/old',
      headers: [],
      params: [],
      auth: defaultAuth(),
      body: '',
      body_type: 'none',
      pre_request_script: '',
      post_request_script: '',
      pre_request_scripts: [],
      post_request_scripts: [],
      comment: '',
      tags: ''
    });

    await store.dispatch(requestLoadRequest({ req }));

    expect(store.getState().modals.pendingLoadRequest).toEqual({
      req,
      reason: 'dirty-tab'
    });
    expect(
      asRequestTab(
        store.getState().tabs.tabs.find((tab) => isRequestTab(tab) && tab.draft.id === 101)
      ).draft.url
    ).toBe('https://example.com/edited');
  });

  it('reloads a dirty tab when forceReload is true', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const { requestLoadRequest } = await import('#/renderer/src/store/thunks/requests');
    await resetPendingLoadRequest(store);
    const req = sampleSaved({ id: 102 });

    await openDirtySavedTab(store, {
      id: 102,
      collection_id: 10,
      folder_id: null,
      name: 'Get users',
      method: 'GET',
      url: 'https://example.com/old',
      headers: [],
      params: [],
      auth: defaultAuth(),
      body: '',
      body_type: 'none',
      pre_request_script: '',
      post_request_script: '',
      pre_request_scripts: [],
      post_request_scripts: [],
      comment: '',
      tags: ''
    });

    await store.dispatch(requestLoadRequest({ req, skipSettingsCheck: true, forceReload: true }));

    expect(store.getState().modals.pendingLoadRequest).toBeNull();
    expect(
      asRequestTab(
        store.getState().tabs.tabs.find((tab) => isRequestTab(tab) && tab.draft.id === 102)
      ).draft.url
    ).toBe('https://example.com/users');
  });

  it('reloads a clean existing tab without prompting', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const { loadRequest } = await import('#/renderer/src/store/slices/tabsSlice');
    const { requestLoadRequest } = await import('#/renderer/src/store/thunks/requests');
    await resetPendingLoadRequest(store);
    const req = sampleSaved({ id: 103, url: 'https://example.com/old' });

    store.dispatch(loadRequest({ req }));

    await store.dispatch(requestLoadRequest({ req: sampleSaved({ id: 103 }) }));

    expect(store.getState().modals.pendingLoadRequest).toBeNull();
    expect(
      store.getState().tabs.tabs.filter((tab) => isRequestTab(tab) && tab.draft.id === 103)
    ).toHaveLength(1);
    expect(
      asRequestTab(
        store.getState().tabs.tabs.find((tab) => isRequestTab(tab) && tab.draft.id === 103)
      ).draft.url
    ).toBe('https://example.com/users');
  });

  it('loads a request without activating the tab when activate is false', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const { openPageTab } = await import('#/renderer/src/store/slices/tabsSlice');
    const { requestLoadRequest } = await import('#/renderer/src/store/thunks/requests');
    await resetPendingLoadRequest(store);
    store.dispatch(openPageTab({ type: 'collection-runner', collectionId: 10 }));
    const runnerTabId = store.getState().tabs.activeTabId;
    const req = sampleSaved({ id: 104 });

    await store.dispatch(
      requestLoadRequest({ req, skipSettingsCheck: true, forceReload: true, activate: false })
    );

    expect(store.getState().tabs.activeTabId).toBe(runnerTabId);
    expect(
      store.getState().tabs.tabs.some((tab) => isRequestTab(tab) && tab.draft.id === 104)
    ).toBe(true);
  });
});

describe('sendRequest', () => {
  it('sends from the given tab without requiring it to be active', async () => {
    const sendRequestApiMock = vi.fn().mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{}',
      timeMs: 5,
      sizeBytes: 2
    });
    const runScriptMock = vi.fn().mockResolvedValue({ logs: [], tests: [], error: undefined });

    vi.stubGlobal('window', {
      api: {
        saveRequest: saveRequestMock,
        listRequests: listRequestsMock,
        listFolders: listFoldersMock,
        cancelRequest: cancelRequestMock,
        sendRequest: sendRequestApiMock,
        runScript: runScriptMock,
        getCookies: vi.fn().mockResolvedValue([]),
        pushPluginHttpAfterSend: vi.fn().mockResolvedValue(undefined)
      }
    });

    const { store } = await import('#/renderer/src/store/redux');
    const { loadRequest, openPageTab, setActiveTab } =
      await import('#/renderer/src/store/slices/tabsSlice');
    const { sendRequest } = await import('#/renderer/src/store/thunks/requests');

    store.dispatch(openPageTab({ type: 'collection-runner', collectionId: 10 }));
    const runnerTabId = store.getState().tabs.activeTabId;
    store.dispatch(loadRequest({ req: sampleSaved({ id: 200 }) }));
    const requestTab = store
      .getState()
      .tabs.tabs.find((tab) => isRequestTab(tab) && tab.draft.id === 200);
    if (!requestTab || !isRequestTab(requestTab)) {
      throw new Error('expected request tab');
    }
    store.dispatch(setActiveTab(runnerTabId));

    await store.dispatch(sendRequest(requestTab.tabId)).unwrap();

    expect(store.getState().tabs.activeTabId).toBe(runnerTabId);
    expect(sendRequestApiMock).toHaveBeenCalledTimes(1);
    const updatedTab = asRequestTab(
      store.getState().tabs.tabs.find((tab) => tab.tabId === requestTab.tabId)
    );
    expect(updatedTab.response?.status).toBe(200);
  });
});

describe('executeRequestDraft hc.data threading', () => {
  it('forwards data from one script slot to the next', async () => {
    const sendRequestApiMock = vi.fn().mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{}',
      timeMs: 5,
      sizeBytes: 2
    });
    const firstScript = createInlineScriptRef('hc.data.mocks = { id: 1 };', 'Define mocks');
    const secondScript = createInlineScriptRef('hc.data.mocks.id;', 'Use mocks');
    const runScriptMock = vi
      .fn()
      .mockResolvedValueOnce({
        request: {
          method: 'GET' as const,
          url: 'https://example.com',
          headers: [],
          params: [],
          body: '',
          bodyType: 'none' as const
        },
        variableSets: {},
        variableClears: [],
        collectionVariableSets: {},
        collectionVariableClears: [],
        folderVariableSets: {},
        folderVariableClears: [],
        environmentVariableSets: {},
        environmentVariableClears: [],
        globalVariableSets: {},
        globalVariableClears: [],
        cookieSets: {},
        cookieClears: [],
        collectionHeaders: [],
        folderHeaders: [],
        tests: [],
        logs: [],
        executionEvents: [],
        data: { mocks: { id: 1 } }
      })
      .mockResolvedValueOnce({
        request: {
          method: 'GET' as const,
          url: 'https://example.com',
          headers: [],
          params: [],
          body: '',
          bodyType: 'none' as const
        },
        variableSets: {},
        variableClears: [],
        collectionVariableSets: {},
        collectionVariableClears: [],
        folderVariableSets: {},
        folderVariableClears: [],
        environmentVariableSets: {},
        environmentVariableClears: [],
        globalVariableSets: {},
        globalVariableClears: [],
        cookieSets: {},
        cookieClears: [],
        collectionHeaders: [],
        folderHeaders: [],
        tests: [],
        logs: [],
        executionEvents: [],
        data: { mocks: { id: 1 } }
      });

    vi.stubGlobal('window', {
      api: {
        saveRequest: saveRequestMock,
        listRequests: listRequestsMock,
        listFolders: listFoldersMock,
        cancelRequest: cancelRequestMock,
        sendRequest: sendRequestApiMock,
        runScript: runScriptMock,
        getCookies: vi.fn().mockResolvedValue([]),
        pushPluginHttpAfterSend: vi.fn().mockResolvedValue(undefined)
      }
    });

    const { store } = await import('#/renderer/src/store/redux');
    const { executeRequestDraft } = await import('#/renderer/src/store/thunks/requests');

    await executeRequestDraft(
      {
        draft: {
          name: 'Threaded data',
          method: 'GET',
          url: 'https://example.com',
          headers: [],
          params: [],
          body: '',
          body_type: 'none',
          pre_request_script: '',
          post_request_script: '',
          pre_request_scripts: [firstScript, secondScript],
          post_request_scripts: [],
          comment: '',
          tags: '',
          auth: defaultAuth()
        },
        requestId: 'req-thread-data'
      },
      { dispatch: store.dispatch, getState: store.getState }
    );

    expect(runScriptMock).toHaveBeenCalledTimes(2);
    expect(runScriptMock.mock.calls[0]?.[0]?.data).toEqual({});
    expect(runScriptMock.mock.calls[1]?.[0]?.data).toEqual({ mocks: { id: 1 } });
  });
});

describe('cancelRequest', () => {
  it('cancels the in-flight request for the given tab id', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const { openTabWithDraft, updateTab } = await import('#/renderer/src/store/slices/tabsSlice');
    const { cancelRequest } = await import('#/renderer/src/store/thunks/requests');

    store.dispatch(
      openTabWithDraft({
        name: 'Users',
        method: 'GET',
        url: 'https://example.com/users',
        headers: [],
        params: [],
        body: '',
        body_type: 'none',
        pre_request_script: '',
        post_request_script: '',
        pre_request_scripts: [],
        post_request_scripts: [],
        comment: '',
        tags: '',
        auth: defaultAuth()
      })
    );

    const tabId = store.getState().tabs.activeTabId;
    store.dispatch(
      updateTab({
        tabId,
        updates: { sending: true, sendingRequestId: 'req-42' }
      })
    );

    await store.dispatch(cancelRequest(tabId));

    expect(cancelRequestMock).toHaveBeenCalledWith('req-42');
    const tab = asRequestTab(store.getState().tabs.tabs.find((t) => t.tabId === tabId));
    expect(tab.sending).toBe(false);
    expect(tab.sendingRequestId).toBeNull();
  });
});

describe('closeRequestTab', () => {
  it('cancels an in-flight send before removing the tab', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const { newTab, updateTab } = await import('#/renderer/src/store/slices/tabsSlice');
    const { closeRequestTab } = await import('#/renderer/src/store/thunks/requests');

    store.dispatch(newTab());
    const firstTabId = store.getState().tabs.activeTabId;
    store.dispatch(newTab());
    const secondTabId = store.getState().tabs.activeTabId;

    store.dispatch(
      updateTab({
        tabId: firstTabId,
        updates: { sending: true, sendingRequestId: 'req-close' }
      })
    );

    await store.dispatch(closeRequestTab(firstTabId));

    expect(cancelRequestMock).toHaveBeenCalledWith('req-close');
    expect(store.getState().tabs.tabs.some((tab) => tab.tabId === firstTabId)).toBe(false);
    expect(store.getState().tabs.activeTabId).toBe(secondTabId);
  });
});
