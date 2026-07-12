import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import type { Collection, SavedRequest } from '#/shared/types';
import { isRequestTab, isPageTab } from '#/renderer/src/store/drafts';

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

const consumeBuiltinCollectionOpenRequestTargetMock =
  vi.fn<() => Promise<{ collectionUuid: string; requestUuid: string } | null>>();
const listCollectionsMock =
  vi.fn<() => Promise<{ collections: Collection[]; warnings: string[] }>>();
const listFoldersMock = vi.fn<(collectionId: number) => Promise<unknown[]>>();
const listRequestsMock = vi.fn<(collectionId: number) => Promise<SavedRequest[]>>();
const listDocumentsMock = vi.fn<(collectionId: number) => Promise<unknown[]>>();

const COLLECTION_UUID = '11111111-1111-4111-8111-111111111111';
const REQUEST_UUID = '22222222-2222-4222-8222-222222222222';

/**
 * Builds a saved request row for listRequests mocks.
 *
 * @param id - Saved request id.
 * @param name - Display name.
 */
function sampleRequest(id: number, name: string): SavedRequest {
  return {
    id,
    uuid: REQUEST_UUID,
    collection_id: 1,
    folder_id: null,
    name,
    method: 'GET',
    url: 'https://echo.harborclient.com/get',
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
    updated_at: '2026-01-01T00:00:00.000Z'
  };
}

/**
 * Builds a collection row matching the seeded open target.
 */
function sampleCollection(): Collection {
  return {
    id: 1,
    uuid: COLLECTION_UUID,
    name: 'HarborClient Echo',
    variables: [],
    headers: [],
    auth: defaultAuth(),
    pre_request_script: '',
    post_request_script: '',
    pre_request_scripts: [],
    post_request_scripts: [],
    created_at: '2026-01-01T00:00:00.000Z'
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('localStorage', createLocalStorageMock());
  vi.stubGlobal('window', {
    api: {
      consumeBuiltinCollectionOpenRequestTarget: consumeBuiltinCollectionOpenRequestTargetMock,
      listCollections: listCollectionsMock,
      listFolders: listFoldersMock,
      listRequests: listRequestsMock,
      listDocuments: listDocumentsMock
    }
  });

  consumeBuiltinCollectionOpenRequestTargetMock.mockReset();
  listCollectionsMock.mockReset();
  listFoldersMock.mockReset();
  listRequestsMock.mockReset();
  listDocumentsMock.mockReset();

  consumeBuiltinCollectionOpenRequestTargetMock.mockResolvedValue({
    collectionUuid: COLLECTION_UUID,
    requestUuid: REQUEST_UUID
  });
  listCollectionsMock.mockResolvedValue({
    collections: [sampleCollection()],
    warnings: []
  });
  listFoldersMock.mockResolvedValue([]);
  listRequestsMock.mockResolvedValue([sampleRequest(10, 'Echo GET')]);
  listDocumentsMock.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('openSeededBuiltinRequestIfNeeded', () => {
  it('opens the seeded request and replaces the pristine default tab', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const { setCollections } = await import('#/renderer/src/store/slices/collectionsSlice');
    const { openSeededBuiltinRequestIfNeeded } =
      await import('#/renderer/src/store/thunks/collections');

    store.dispatch(setCollections([sampleCollection()]));

    await store.dispatch(openSeededBuiltinRequestIfNeeded());

    const tabs = store.getState().tabs.tabs;
    expect(tabs).toHaveLength(1);
    expect(isRequestTab(tabs[0]!)).toBe(true);
    if (isRequestTab(tabs[0]!)) {
      expect(tabs[0].draft.id).toBe(10);
      expect(tabs[0].draft.name).toBe('Echo GET');
    }
    expect(store.getState().collections.selectedCollectionId).toBe(1);
    expect(consumeBuiltinCollectionOpenRequestTargetMock).toHaveBeenCalledTimes(1);
  });

  it('closes the pristine default tab when another page tab is already open', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const { setCollections } = await import('#/renderer/src/store/slices/collectionsSlice');
    const { openPageTab } = await import('#/renderer/src/store/slices/tabsSlice');
    const { openSeededBuiltinRequestIfNeeded } =
      await import('#/renderer/src/store/thunks/collections');

    store.dispatch(setCollections([sampleCollection()]));
    store.dispatch(openPageTab({ type: 'getting-started' }));

    await store.dispatch(openSeededBuiltinRequestIfNeeded());

    const tabs = store.getState().tabs.tabs;
    expect(tabs).toHaveLength(2);
    expect(tabs.some((tab) => isPageTab(tab) && tab.page.type === 'getting-started')).toBe(true);
    expect(tabs.some((tab) => isRequestTab(tab) && tab.draft.id === 10)).toBe(true);
    expect(tabs.some((tab) => isRequestTab(tab) && tab.draft.name === 'Untitled Request')).toBe(
      false
    );

    const activeTab = tabs.find((tab) => tab.tabId === store.getState().tabs.activeTabId);
    expect(activeTab).toBeDefined();
    expect(isRequestTab(activeTab!)).toBe(true);
    if (isRequestTab(activeTab!)) {
      expect(activeTab.draft.id).toBe(10);
      expect(activeTab.draft.name).toBe('Echo GET');
    }
  });

  it('does nothing when there is no pending open target', async () => {
    consumeBuiltinCollectionOpenRequestTargetMock.mockResolvedValue(null);

    const { store } = await import('#/renderer/src/store/redux');
    const { openSeededBuiltinRequestIfNeeded } =
      await import('#/renderer/src/store/thunks/collections');

    await store.dispatch(openSeededBuiltinRequestIfNeeded());

    const tabs = store.getState().tabs.tabs;
    expect(tabs).toHaveLength(1);
    if (isRequestTab(tabs[0]!)) {
      expect(tabs[0].draft.id).toBeUndefined();
      expect(tabs[0].draft.name).toBe('Untitled Request');
    }
  });
});
