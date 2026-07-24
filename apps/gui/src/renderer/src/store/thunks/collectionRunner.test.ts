import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import { isRequestTab } from '#/renderer/src/store/tabs';
import type { SavedRequest } from '#/shared/types';

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

const sendRequestApiMock = vi.fn();
const runScriptMock = vi.fn();
const setCollectionRunnerConfigMock = vi.fn();

/**
 * Builds a saved request fixture for collection runner tests.
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
    name: 'Health',
    method: 'GET',
    url: 'https://example.com/health',
    headers: [],
    params: [],
    auth: defaultAuth(),
    body: '',
    body_type: 'none',
    body_raw: null,
    body_raw_open: false,
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

beforeEach(() => {
  vi.stubGlobal('localStorage', createLocalStorageMock());
  sendRequestApiMock.mockReset();
  sendRequestApiMock.mockResolvedValue({
    status: 200,
    statusText: 'OK',
    headers: {},
    body: '{}',
    timeMs: 5,
    sizeBytes: 2
  });
  runScriptMock.mockReset();
  runScriptMock.mockResolvedValue({ logs: [], tests: [], error: undefined });
  setCollectionRunnerConfigMock.mockReset();
  setCollectionRunnerConfigMock.mockResolvedValue(undefined);
  vi.stubGlobal('window', {
    api: {
      sendRequest: sendRequestApiMock,
      runScript: runScriptMock,
      getCookies: vi.fn().mockResolvedValue([]),
      pushPluginHttpAfterSend: vi.fn().mockResolvedValue(undefined),
      setCollectionRunnerConfig: setCollectionRunnerConfigMock,
      getCollectionRunnerConfig: vi.fn().mockResolvedValue({
        delayMs: 0,
        stopOnFailure: false,
        environmentMode: 'active',
        environmentId: null
      })
    }
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('runCollectionRequests', () => {
  it('keeps the collection runner tab active while requests run', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const { openPageTab } = await import('#/renderer/src/store/slices/tabsSlice');
    const { openCollectionRunner } = await import('#/renderer/src/store/slices/modalsSlice');
    const { setCollections, setRequestsForCollection } =
      await import('#/renderer/src/store/slices/collectionsSlice');
    const { runCollectionRequests } = await import('#/renderer/src/store/thunks/collectionRunner');

    store.dispatch(
      setCollections([
        {
          id: 10,
          uuid: '',
          name: 'Demo API',
          variables: [],
          headers: [],
          pre_request_script: '',
          post_request_script: '',
          pre_request_scripts: [],
          post_request_scripts: [],
          auth: defaultAuth(),
          created_at: '2026-01-01T00:00:00.000Z'
        }
      ])
    );
    store.dispatch(openPageTab({ type: 'collection-runner', collectionId: 10 }));
    const runnerTabId = store.getState().tabs.activeTabId;

    store.dispatch(
      openCollectionRunner({
        collectionId: 10,
        collectionName: 'Demo API'
      })
    );

    const requests = [
      sampleSaved({ id: 1, name: 'Health' }),
      sampleSaved({ id: 2, name: 'Users', url: 'https://example.com/users' })
    ];

    store.dispatch(setRequestsForCollection({ collectionId: 10, requests }));

    await store.dispatch(runCollectionRequests()).unwrap();

    expect(store.getState().tabs.activeTabId).toBe(runnerTabId);
    expect(sendRequestApiMock).toHaveBeenCalledTimes(2);
    expect(store.getState().modals.collectionRunner?.phase).toBe('complete');
    expect(store.getState().modals.collectionRunner?.summary.passed).toBe(2);
    expect(store.getState().modals.collectionRunner?.results[0]?.response?.status).toBe(200);

    const requestTabs = store
      .getState()
      .tabs.tabs.filter((tab) => isRequestTab(tab) && tab.draft.collection_id === 10);
    expect(requestTabs).toHaveLength(0);
  });
});
