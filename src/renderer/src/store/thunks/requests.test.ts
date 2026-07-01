import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import { asRequestTab, isRequestTab } from '#/renderer/src/store/drafts';
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
    comment: input.comment ?? '',
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
      cancelRequest: cancelRequestMock
    }
  });
  saveRequestMock.mockReset();
  saveRequestMock.mockImplementation((input) => Promise.resolve(savedFrom(input)));
  listRequestsMock.mockReset();
  listRequestsMock.mockResolvedValue([]);
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
        comment: '',
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
        comment: '',
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
    comment: '',
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
      comment: ''
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
      comment: ''
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

    store.dispatch(loadRequest(req));

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
        comment: '',
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
