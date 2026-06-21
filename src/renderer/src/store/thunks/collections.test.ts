import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import type { Collection, ListCollectionsResult } from '#/shared/types';
import type { RequestDraft } from '#/renderer/src/store/drafts';

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

const deleteCollectionMock = vi.fn<(id: number) => Promise<void>>();
const listCollectionsMock = vi.fn<() => Promise<ListCollectionsResult>>();

/**
 * Builds a minimal collection row for listCollections mocks.
 *
 * @param id - Collection id.
 * @param name - Display name.
 */
function sampleCollection(id: number, name: string): Collection {
  return {
    id,
    name,
    variables: [],
    headers: [],
    auth: defaultAuth(),
    pre_request_script: '',
    post_request_script: '',
    created_at: '2026-01-01T00:00:00.000Z'
  };
}

/**
 * Builds a saved-request draft tied to a collection for tab seeding.
 *
 * @param collectionId - Owning collection id.
 * @param name - Tab display name.
 */
function draftForCollection(collectionId: number, name: string): RequestDraft {
  return {
    id: collectionId * 10,
    collection_id: collectionId,
    name,
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
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', createLocalStorageMock());
  vi.stubGlobal('window', {
    api: {
      deleteCollection: deleteCollectionMock,
      listCollections: listCollectionsMock
    }
  });
  deleteCollectionMock.mockReset();
  deleteCollectionMock.mockResolvedValue(undefined);
  listCollectionsMock.mockReset();
  listCollectionsMock.mockResolvedValue({
    collections: [sampleCollection(2, 'Remaining')],
    warnings: []
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('deleteCollection', () => {
  it('closes open editor tabs belonging to the deleted collection', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const { openTabWithDraft } = await import('#/renderer/src/store/slices/tabsSlice');
    const { deleteCollection } = await import('#/renderer/src/store/thunks/collections');

    store.dispatch(openTabWithDraft(draftForCollection(1, 'Collection One Request')));
    store.dispatch(openTabWithDraft(draftForCollection(2, 'Collection Two Request')));

    await store.dispatch(deleteCollection(1));

    expect(deleteCollectionMock).toHaveBeenCalledWith(1);

    const tabs = store.getState().tabs.tabs;
    expect(tabs.some((tab) => tab.draft.collection_id === 1)).toBe(false);
    expect(tabs.some((tab) => tab.draft.name === 'Collection Two Request')).toBe(true);
  });
});

describe('refreshCollections', () => {
  it('ignores stale listCollections responses that finish after a newer refresh', async () => {
    let resolveStaleRefresh!: (value: ListCollectionsResult) => void;
    const staleRefresh = new Promise<ListCollectionsResult>((resolve) => {
      resolveStaleRefresh = resolve;
    });

    listCollectionsMock.mockReturnValueOnce(staleRefresh).mockResolvedValueOnce({
      collections: [sampleCollection(2, 'Fresh')],
      warnings: []
    });

    const { store } = await import('#/renderer/src/store/redux');
    const { refreshCollections } = await import('#/renderer/src/store/thunks/collections');

    const firstRefresh = store.dispatch(refreshCollections());
    const secondRefresh = store.dispatch(refreshCollections());

    await secondRefresh;
    expect(store.getState().collections.collections[0]?.name).toBe('Fresh');

    resolveStaleRefresh({
      collections: [sampleCollection(1, 'Stale')],
      warnings: []
    });
    await firstRefresh;

    expect(store.getState().collections.collections[0]?.name).toBe('Fresh');
  });
});
