import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultAuth } from '@harborclient/core/auth';
import type {
  Collection,
  CollectionDocument,
  Folder,
  SavedRequest
} from '@harborclient/core/types';
import {
  createDocumentForPlugin,
  createFolderForPlugin,
  createRequestForPlugin,
  deleteDocumentForPlugin,
  deleteFolderForPlugin,
  duplicateCollectionForPlugin,
  reorderContainerItemsForPlugin,
  setCollectionArchivedForPlugin,
  validateContainerItemRefs,
  validateNonEmptyName,
  validateNumericId,
  validateOrderedIds
} from './hostLibraryMutations';

const dispatchMock = vi.fn();
const unwrapMock = vi.fn();
const getStateMock = vi.fn();
const listFoldersMock = vi.fn();
const listRequestsMock = vi.fn();
const listDocumentsMock = vi.fn();
const listCollectionsMock = vi.fn();
const saveRequestMock = vi.fn();
const getCollectionMetadataMock = vi.fn();

vi.mock('#/renderer/src/store/redux', () => ({
  store: {
    dispatch: (...args: unknown[]) => dispatchMock(...args),
    getState: () => getStateMock()
  }
}));

vi.mock('#/renderer/src/store/slices/collectionsSlice', () => ({
  setSelectedCollectionId: (id: number) => ({ type: 'setSelectedCollectionId', payload: id })
}));

vi.mock('#/renderer/src/store/slices/tabsSlice', () => ({
  openTabWithDraft: (draft: unknown) => ({ type: 'openTabWithDraft', payload: draft })
}));

vi.mock('#/renderer/src/store/tabs', () => ({
  draftFromSaved: (req: SavedRequest) => ({ id: req.id, name: req.name })
}));

vi.mock('#/renderer/src/store/thunks/collections', () => ({
  createFolder: (payload: unknown) => ({ type: 'createFolder', payload }),
  deleteCollection: (id: number) => ({ type: 'deleteCollection', payload: id }),
  deleteFolder: (payload: unknown) => ({ type: 'deleteFolder', payload }),
  duplicateCollection: (id: number) => ({ type: 'duplicateCollection', payload: id }),
  moveFolder: (payload: unknown) => ({ type: 'moveFolder', payload }),
  moveRequestToFolder: (payload: unknown) => ({ type: 'moveRequestToFolder', payload }),
  refreshCollectionContents: (id: number) => ({ type: 'refreshCollectionContents', payload: id }),
  renameFolder: (payload: unknown) => ({ type: 'renameFolder', payload }),
  reorderCollections: (payload: unknown) => ({ type: 'reorderCollections', payload }),
  reorderContainerItems: (payload: unknown) => ({ type: 'reorderContainerItems', payload }),
  reorderFolders: (payload: unknown) => ({ type: 'reorderFolders', payload }),
  reorderRequests: (payload: unknown) => ({ type: 'reorderRequests', payload }),
  setCollectionArchived: (payload: unknown) => ({ type: 'setCollectionArchived', payload }),
  updateCollection: (payload: unknown) => ({ type: 'updateCollection', payload })
}));

vi.mock('#/renderer/src/store/thunks/documents', () => ({
  deleteDocument: (payload: unknown) => ({ type: 'deleteDocument', payload }),
  moveDocumentToFolder: (payload: unknown) => ({ type: 'moveDocumentToFolder', payload }),
  newDocumentInCollection: (payload: unknown) => ({ type: 'newDocumentInCollection', payload }),
  newDocumentInFolder: (payload: unknown) => ({ type: 'newDocumentInFolder', payload }),
  renameDocument: (payload: unknown) => ({ type: 'renameDocument', payload }),
  reorderDocuments: (payload: unknown) => ({ type: 'reorderDocuments', payload })
}));

vi.mock('#/renderer/src/store/thunks/requests', () => ({
  deleteRequest: (id: number) => ({ type: 'deleteRequest', payload: id }),
  duplicateRequest: (req: SavedRequest) => ({ type: 'duplicateRequest', payload: req })
}));

vi.mock('./hostRequestCommands', () => ({
  findSavedRequest: () => undefined,
  getCollectionMetadataForPlugin: (...args: unknown[]) => getCollectionMetadataMock(...args)
}));

/**
 * Builds a minimal collection fixture for mutation tests.
 *
 * @param overrides - Fields to override on the base collection.
 */
function makeCollection(overrides: Partial<Collection> = {}): Collection {
  return {
    id: 1,
    uuid: 'col-1',
    name: 'API',
    variables: [],
    headers: [],
    userAgent: '',
    auth: defaultAuth(),
    pre_request_script: '',
    post_request_script: '',
    pre_request_scripts: [],
    post_request_scripts: [],
    created_at: '2026-01-01T00:00:00.000Z',
    marker: '#32D2E2',
    ...overrides
  };
}

/**
 * Builds a minimal folder fixture for mutation tests.
 *
 * @param overrides - Fields to override on the base folder.
 */
function makeFolder(overrides: Partial<Folder> = {}): Folder {
  return {
    id: 10,
    uuid: 'folder-10',
    collection_id: 1,
    parent_folder_id: null,
    name: 'Auth',
    sort_order: 0,
    variables: [],
    headers: [],
    userAgent: '',
    auth: defaultAuth(),
    pre_request_script: '',
    post_request_script: '',
    pre_request_scripts: [],
    post_request_scripts: [],
    created_at: '2026-01-01T00:00:00.000Z',
    marker: null,
    ...overrides
  };
}

/**
 * Builds a minimal saved-request fixture for mutation tests.
 *
 * @param overrides - Fields to override on the base request.
 */
function makeRequest(overrides: Partial<SavedRequest> = {}): SavedRequest {
  return {
    id: 42,
    uuid: 'req-42',
    collection_id: 1,
    name: 'Login',
    method: 'POST',
    url: 'https://example.com/login',
    headers: [],
    params: [],
    auth: defaultAuth(),
    userAgent: '',
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
    folder_id: 10,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    marker: null,
    ...overrides,
    protocol: overrides.protocol ?? 'http'
  };
}

/**
 * Builds a minimal document fixture for mutation tests.
 *
 * @param overrides - Fields to override on the base document.
 */
function makeDocument(overrides: Partial<CollectionDocument> = {}): CollectionDocument {
  return {
    id: 100,
    uuid: 'doc-100',
    collection_id: 1,
    folder_id: null,
    name: 'README.md',
    content: '# Docs',
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-03T00:00:00.000Z',
    marker: null,
    ...overrides
  };
}

beforeEach(() => {
  dispatchMock.mockReset();
  unwrapMock.mockReset();
  getStateMock.mockReset();
  listFoldersMock.mockReset();
  listRequestsMock.mockReset();
  listDocumentsMock.mockReset();
  listCollectionsMock.mockReset();
  saveRequestMock.mockReset();
  getCollectionMetadataMock.mockReset();
  dispatchMock.mockReturnValue({ unwrap: unwrapMock });
  getStateMock.mockReturnValue({
    collections: {
      requestsByCollection: {},
      documentsByCollection: {}
    }
  });
  listFoldersMock.mockResolvedValue([]);
  listRequestsMock.mockResolvedValue([]);
  listDocumentsMock.mockResolvedValue([]);
  listCollectionsMock.mockResolvedValue({ collections: [], warnings: [] });
  vi.stubGlobal('window', {
    api: {
      listFolders: listFoldersMock,
      listRequests: listRequestsMock,
      listDocuments: listDocumentsMock,
      listCollections: listCollectionsMock,
      saveRequest: saveRequestMock
    }
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('hostLibraryMutations validators', () => {
  it('rejects non-numeric ids and empty names', () => {
    expect(() => validateNumericId('1', 'collectionId', 'createFolder')).toThrow(
      /numeric collectionId/
    );
    expect(() => validateNonEmptyName('  ', 'createFolder')).toThrow(/non-empty name/);
    expect(() => validateOrderedIds([1, '2'], 'reorderCollections')).toThrow(
      /array of numeric ids/
    );
  });
});

describe('setCollectionArchivedForPlugin', () => {
  it('archives a collection through the store thunk', async () => {
    unwrapMock.mockResolvedValue(undefined);

    await setCollectionArchivedForPlugin({ collectionId: 1, archived: true });

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'setCollectionArchived',
      payload: { id: 1, archived: true }
    });
  });

  it('rejects a non-boolean archived flag', async () => {
    await expect(
      setCollectionArchivedForPlugin({
        collectionId: 1,
        archived: 'yes' as unknown as boolean
      })
    ).rejects.toThrow(/boolean archived/);
  });
});

describe('duplicateCollectionForPlugin', () => {
  it('returns a collection summary for the duplicate', async () => {
    unwrapMock.mockResolvedValue(makeCollection({ id: 2, name: 'API (copy)', uuid: 'col-2' }));

    await expect(duplicateCollectionForPlugin(1)).resolves.toEqual(
      expect.objectContaining({ id: 2, name: 'API (copy)', uuid: 'col-2' })
    );
  });
});

describe('createFolderForPlugin', () => {
  it('creates a folder and returns a summary', async () => {
    unwrapMock.mockResolvedValue(makeFolder());

    await expect(
      createFolderForPlugin({ collectionId: 1, name: ' Auth ', parentFolderId: null })
    ).resolves.toEqual(
      expect.objectContaining({
        id: 10,
        name: 'Auth',
        collection_id: 1,
        parent_folder_id: null
      })
    );

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'createFolder',
      payload: { collectionId: 1, name: 'Auth', parentFolderId: null }
    });
  });

  it('rejects empty folder names', async () => {
    await expect(createFolderForPlugin({ collectionId: 1, name: '  ' })).rejects.toThrow(
      /non-empty name/
    );
  });
});

describe('deleteFolderForPlugin', () => {
  it('computes subtree request ids before dispatching deleteFolder', async () => {
    listFoldersMock.mockResolvedValue([
      makeFolder(),
      makeFolder({ id: 11, parent_folder_id: 10, name: 'nested', uuid: 'folder-11' })
    ]);
    listRequestsMock.mockResolvedValue([
      makeRequest({ id: 42, folder_id: 10 }),
      makeRequest({ id: 43, folder_id: 11, uuid: 'req-43' }),
      makeRequest({ id: 44, folder_id: null, uuid: 'req-44' })
    ]);
    unwrapMock.mockResolvedValue(undefined);

    await deleteFolderForPlugin({ folderId: 10, collectionId: 1 });

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'deleteFolder',
      payload: { id: 10, collectionId: 1, requestIds: [42, 43] }
    });
  });
});

describe('createRequestForPlugin', () => {
  it('saves a request, opens a tab, and returns a summary', async () => {
    const saved = makeRequest({ folder_id: 10, name: 'Login', method: 'POST' });
    saveRequestMock.mockResolvedValue(saved);
    unwrapMock.mockResolvedValue(undefined);

    await expect(
      createRequestForPlugin({
        collectionId: 1,
        folderId: 10,
        name: 'Login',
        method: 'POST',
        protocol: 'http' as const,
        url: 'https://example.com/login'
      })
    ).resolves.toEqual(
      expect.objectContaining({
        id: 42,
        name: 'Login',
        method: 'POST',
        folder_id: 10
      })
    );

    expect(saveRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collection_id: 1,
        folder_id: 10,
        name: 'Login',
        method: 'POST'
      })
    );
    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'setSelectedCollectionId',
      payload: 1
    });
    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'openTabWithDraft',
      payload: { id: 42, name: 'Login' }
    });
  });
});

describe('createDocumentForPlugin / deleteDocumentForPlugin', () => {
  it('creates a document at collection root', async () => {
    unwrapMock.mockResolvedValue(makeDocument());

    await expect(
      createDocumentForPlugin({ collectionId: 1, name: 'README.md', content: '# Docs' })
    ).resolves.toEqual(expect.objectContaining({ id: 100, name: 'README.md' }));

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'newDocumentInCollection',
      payload: { collectionId: 1, name: 'README.md', content: '# Docs' }
    });
  });

  it('deletes a document through the store thunk', async () => {
    unwrapMock.mockResolvedValue(undefined);

    await deleteDocumentForPlugin({ id: 100, collectionId: 1 });

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'deleteDocument',
      payload: { id: 100, collectionId: 1 }
    });
  });
});

describe('validateContainerItemRefs', () => {
  it('accepts request and document refs', () => {
    expect(
      validateContainerItemRefs(
        [
          { kind: 'request', id: 1 },
          { kind: 'document', id: 2 }
        ],
        'reorderContainerItems'
      )
    ).toEqual([
      { kind: 'request', id: 1 },
      { kind: 'document', id: 2 }
    ]);
  });

  it('rejects invalid item shapes', () => {
    expect(() => validateContainerItemRefs(null, 'reorderContainerItems')).toThrow(/items array/);
    expect(() =>
      validateContainerItemRefs([{ kind: 'folder', id: 1 }], 'reorderContainerItems')
    ).toThrow(/request.*document/);
  });
});

describe('reorderContainerItemsForPlugin', () => {
  it('dispatches interleaved request and document order', async () => {
    unwrapMock.mockResolvedValue(undefined);

    await reorderContainerItemsForPlugin({
      collectionId: 1,
      folderId: null,
      items: [
        { kind: 'request', id: 42 },
        { kind: 'document', id: 100 }
      ]
    });

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'reorderContainerItems',
      payload: {
        collectionId: 1,
        folderId: null,
        items: [
          { kind: 'request', id: 42 },
          { kind: 'document', id: 100 }
        ]
      }
    });
  });
});
