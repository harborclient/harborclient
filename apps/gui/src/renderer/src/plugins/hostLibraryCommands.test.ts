import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultAuth } from '@harborclient/core/auth';
import type {
  Collection,
  CollectionDocument,
  Folder,
  SavedRequest
} from '@harborclient/core/types';
import {
  listCollectionsForPlugin,
  listDocumentsForPlugin,
  listFoldersForPlugin,
  listLibraryTreeForPlugin,
  listRequestsForPlugin,
  toCollectionSummary,
  toDocumentSummary,
  toFolderSummary,
  toSavedRequestSummary,
  validateCollectionId
} from './hostLibraryCommands';

const listCollectionsMock = vi.fn();
const listFoldersMock = vi.fn();
const listRequestsMock = vi.fn();
const listDocumentsMock = vi.fn();

/**
 * Builds a minimal collection fixture for host library tests.
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
 * Builds a minimal folder fixture for host library tests.
 *
 * @param overrides - Fields to override on the base folder.
 */
function makeFolder(overrides: Partial<Folder> = {}): Folder {
  return {
    id: 10,
    uuid: 'folder-10',
    collection_id: 1,
    parent_folder_id: null,
    name: 'pets',
    sort_order: 0,
    variables: [{ key: 'secret', value: 'x', defaultValue: '', enabled: true, share: false }],
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
 * Builds a minimal saved-request fixture for host library tests.
 *
 * @param overrides - Fields to override on the base request.
 */
function makeRequest(overrides: Partial<SavedRequest> = {}): SavedRequest {
  return {
    id: 42,
    uuid: 'req-42',
    collection_id: 1,
    name: 'List pets',
    method: 'GET',
    url: 'https://example.com/pets',
    headers: [{ key: 'Authorization', value: 'secret', enabled: true }],
    params: [],
    auth: defaultAuth(),
    userAgent: '',
    body: '{"secret":true}',
    body_type: 'json',
    body_raw: null,
    body_raw_open: false,
    pre_request_script: '',
    post_request_script: '',
    pre_request_scripts: [],
    post_request_scripts: [],
    comment: '',
    tags: '',
    folder_id: 10,
    sort_order: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    marker: null,
    ...overrides,
    protocol: overrides.protocol ?? 'http'
  };
}

/**
 * Builds a minimal document fixture for host library tests.
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
    content: '# Secret docs',
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-03T00:00:00.000Z',
    marker: null,
    ...overrides
  };
}

beforeEach(() => {
  listCollectionsMock.mockReset();
  listFoldersMock.mockReset();
  listRequestsMock.mockReset();
  listDocumentsMock.mockReset();
  listCollectionsMock.mockResolvedValue({ collections: [], warnings: [] });
  listFoldersMock.mockResolvedValue([]);
  listRequestsMock.mockResolvedValue([]);
  listDocumentsMock.mockResolvedValue([]);
  vi.stubGlobal('window', {
    api: {
      listCollections: listCollectionsMock,
      listFolders: listFoldersMock,
      listRequests: listRequestsMock,
      listDocuments: listDocumentsMock
    }
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('hostLibraryCommands mappers', () => {
  it('strips settings and body payloads from summaries', () => {
    const collection = makeCollection({ archived: true, connectionId: 'local' });
    const folder = makeFolder({ parent_folder_id: 9 });
    const request = makeRequest();
    const document = makeDocument();

    expect(toCollectionSummary(collection)).toEqual({
      id: 1,
      uuid: 'col-1',
      name: 'API',
      marker: '#32D2E2',
      created_at: '2026-01-01T00:00:00.000Z',
      connectionId: 'local',
      archived: true
    });
    expect(toFolderSummary(folder)).toEqual({
      id: 10,
      uuid: 'folder-10',
      collection_id: 1,
      parent_folder_id: 9,
      name: 'pets',
      sort_order: 0,
      marker: null,
      created_at: '2026-01-01T00:00:00.000Z'
    });
    expect(toSavedRequestSummary(request)).toEqual({
      id: 42,
      uuid: 'req-42',
      collection_id: 1,
      folder_id: 10,
      name: 'List pets',
      method: 'GET',
      protocol: 'http' as const,
      sort_order: 1,
      marker: null,
      created_at: '2026-01-01T00:00:00.000Z'
    });
    expect(toDocumentSummary(document)).toEqual({
      id: 100,
      uuid: 'doc-100',
      collection_id: 1,
      folder_id: null,
      name: 'README.md',
      sort_order: 0,
      marker: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-03T00:00:00.000Z'
    });
    expect(toSavedRequestSummary(request)).not.toHaveProperty('body');
    expect(toSavedRequestSummary(request)).not.toHaveProperty('auth');
    expect(toDocumentSummary(document)).not.toHaveProperty('content');
    expect(toFolderSummary(folder)).not.toHaveProperty('variables');
  });

  it('rejects non-numeric collection ids', () => {
    expect(() => validateCollectionId('1', 'listFolders')).toThrow(/numeric collection id/);
  });
});

describe('listCollectionsForPlugin', () => {
  it('returns an empty list for an empty library', async () => {
    await expect(listCollectionsForPlugin()).resolves.toEqual([]);
  });

  it('excludes archived collections by default and includes them when requested', async () => {
    listCollectionsMock.mockResolvedValue({
      collections: [
        makeCollection({ id: 1, name: 'Active' }),
        makeCollection({ id: 2, name: 'Archived', archived: true, uuid: 'col-2' })
      ],
      warnings: []
    });

    await expect(listCollectionsForPlugin()).resolves.toEqual([
      expect.objectContaining({ id: 1, name: 'Active' })
    ]);
    await expect(listCollectionsForPlugin({ includeArchived: true })).resolves.toEqual([
      expect.objectContaining({ id: 1 }),
      expect.objectContaining({ id: 2, archived: true })
    ]);
  });
});

describe('list*ForPlugin granular helpers', () => {
  it('maps nested folders, requests, and documents for a collection', async () => {
    const child = makeFolder({ id: 11, parent_folder_id: 10, name: 'nested', uuid: 'folder-11' });
    listFoldersMock.mockResolvedValue([makeFolder(), child]);
    listRequestsMock.mockResolvedValue([makeRequest()]);
    listDocumentsMock.mockResolvedValue([makeDocument()]);

    await expect(listFoldersForPlugin(1)).resolves.toEqual([
      expect.objectContaining({ id: 10, parent_folder_id: null }),
      expect.objectContaining({ id: 11, parent_folder_id: 10, name: 'nested' })
    ]);
    await expect(listRequestsForPlugin(1)).resolves.toEqual([
      expect.objectContaining({ id: 42, folder_id: 10, method: 'GET' })
    ]);
    await expect(listDocumentsForPlugin(1)).resolves.toEqual([
      expect.objectContaining({ id: 100, name: 'README.md' })
    ]);
    expect(listFoldersMock).toHaveBeenCalledWith(1);
    expect(listRequestsMock).toHaveBeenCalledWith(1);
    expect(listDocumentsMock).toHaveBeenCalledWith(1);
  });
});

describe('listLibraryTreeForPlugin', () => {
  it('aggregates per-collection contents and passes through warnings', async () => {
    listCollectionsMock.mockResolvedValue({
      collections: [makeCollection(), makeCollection({ id: 2, uuid: 'col-2', archived: true })],
      warnings: ['Connection refused']
    });
    listFoldersMock.mockImplementation(async (collectionId: number) =>
      collectionId === 1 ? [makeFolder()] : []
    );
    listRequestsMock.mockImplementation(async (collectionId: number) =>
      collectionId === 1 ? [makeRequest()] : []
    );
    listDocumentsMock.mockImplementation(async (collectionId: number) =>
      collectionId === 1 ? [makeDocument()] : []
    );

    const tree = await listLibraryTreeForPlugin();

    expect(tree.warnings).toEqual(['Connection refused']);
    expect(tree.collections).toHaveLength(1);
    expect(tree.collections[0]).toEqual(
      expect.objectContaining({
        id: 1,
        folders: [expect.objectContaining({ id: 10 })],
        requests: [expect.objectContaining({ id: 42 })],
        documents: [expect.objectContaining({ id: 100 })]
      })
    );
  });

  it('includes archived collections in the tree when requested', async () => {
    listCollectionsMock.mockResolvedValue({
      collections: [makeCollection({ id: 2, uuid: 'col-2', archived: true, name: 'Old' })],
      warnings: []
    });

    const tree = await listLibraryTreeForPlugin({ includeArchived: true });

    expect(tree.collections).toEqual([expect.objectContaining({ id: 2, archived: true })]);
  });
});
