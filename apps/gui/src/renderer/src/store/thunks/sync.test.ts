import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import type { Collection } from '#/shared/types';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn(), loading: vi.fn(), dismiss: vi.fn() }
}));

/**
 * Minimal in-memory localStorage mock for the Redux persistence subscriber.
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

const listStorageConnectionsMock = vi.fn<() => Promise<{ id: string; name: string }[]>>();
const listTeamHubsMock = vi.fn<() => Promise<{ id: string; name: string }[]>>();
const syncProviderMock = vi.fn<(connectionId: string) => Promise<void>>();
const listCollectionsMock =
  vi.fn<() => Promise<{ collections: Collection[]; warnings: string[] }>>();
const listEnvironmentsMock = vi.fn<() => Promise<unknown[]>>();
const listFoldersMock = vi.fn<(collectionId: number) => Promise<unknown[]>>();
const listRequestsMock = vi.fn<(collectionId: number) => Promise<unknown[]>>();

/**
 * Builds a minimal collection row for sync tests.
 *
 * @param id - Collection id.
 * @param name - Display name.
 */
function sampleCollection(id: number, name: string): Collection {
  return {
    id,
    uuid: '',
    name,
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
  vi.stubGlobal('localStorage', createLocalStorageMock());
  vi.stubGlobal('window', {
    api: {
      listStorageConnections: listStorageConnectionsMock,
      listTeamHubs: listTeamHubsMock,
      syncProvider: syncProviderMock,
      listCollections: listCollectionsMock,
      listEnvironments: listEnvironmentsMock,
      listFolders: listFoldersMock,
      listRequests: listRequestsMock
    }
  });

  listStorageConnectionsMock.mockReset();
  listStorageConnectionsMock.mockResolvedValue([{ id: 'conn-a', name: 'Local' }]);
  listTeamHubsMock.mockReset();
  listTeamHubsMock.mockResolvedValue([]);
  syncProviderMock.mockReset();
  syncProviderMock.mockResolvedValue(undefined);
  listCollectionsMock.mockReset();
  listCollectionsMock.mockResolvedValue({
    collections: [sampleCollection(1, 'Only')],
    warnings: []
  });
  listEnvironmentsMock.mockReset();
  listEnvironmentsMock.mockResolvedValue([]);
  listFoldersMock.mockReset();
  listFoldersMock.mockResolvedValue([]);
  listRequestsMock.mockReset();
  listRequestsMock.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('runSync', () => {
  it('does not refresh folder and request caches for pruned collection ids', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const { setFoldersForCollection } =
      await import('#/renderer/src/store/slices/collectionsSlice');
    const { runSync } = await import('#/renderer/src/store/thunks/sync');

    store.dispatch(setFoldersForCollection({ collectionId: 2, folders: [] }));

    await store.dispatch(runSync());

    expect(listFoldersMock).not.toHaveBeenCalledWith(2);
    expect(listRequestsMock).not.toHaveBeenCalledWith(2);
    expect(listFoldersMock).not.toHaveBeenCalled();
    expect(listRequestsMock).not.toHaveBeenCalled();
  });
});
