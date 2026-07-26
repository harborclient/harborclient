import { describe, expect, it } from 'vitest';
import type {
  Collection,
  CollectionDocument,
  Folder,
  SavedRequest
} from '@harborclient/core/types';
import {
  buildCollectionsTreeFilter,
  collectCollectionsTreeColors,
  collectCollectionsTreeStorageLocations,
  EMPTY_COLLECTIONS_FILTER,
  isCollectionsFilterActive,
  type CollectionsFilterCriteria,
  type CollectionsFilterInput
} from './collectionsFilter';

/**
 * Builds a minimal collection fixture for filter tests.
 *
 * @param overrides - Fields to merge onto the base collection.
 */
function makeCollection(overrides: Partial<Collection> & Pick<Collection, 'id'>): Collection {
  return {
    uuid: `col-${overrides.id}`,
    name: `Collection ${overrides.id}`,
    variables: [],
    headers: [],
    userAgent: '',
    auth: { type: 'none' },
    pre_request_script: '',
    post_request_script: '',
    pre_request_scripts: [],
    post_request_scripts: [],
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides
  } as Collection;
}

/**
 * Builds a minimal folder fixture for filter tests.
 *
 * @param overrides - Fields to merge onto the base folder.
 */
function makeFolder(overrides: Partial<Folder> & Pick<Folder, 'id' | 'collection_id'>): Folder {
  return {
    uuid: `folder-${overrides.id}`,
    name: `Folder ${overrides.id}`,
    sort_order: 0,
    variables: [],
    headers: [],
    userAgent: '',
    auth: { type: 'none' },
    pre_request_script: '',
    post_request_script: '',
    pre_request_scripts: [],
    post_request_scripts: [],
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides
  } as Folder;
}

/**
 * Builds a minimal saved-request fixture for filter tests.
 *
 * @param overrides - Fields to merge onto the base request.
 */
function makeRequest(
  overrides: Partial<SavedRequest> & Pick<SavedRequest, 'id' | 'collection_id' | 'method'>
): SavedRequest {
  return {
    uuid: `req-${overrides.id}`,
    name: `Request ${overrides.id}`,
    url: 'https://example.com',
    headers: [],
    userAgent: '',
    params: [],
    auth: { type: 'none' },
    body: '',
    bodyType: 'none',
    formData: [],
    pre_request_script: '',
    post_request_script: '',
    pre_request_scripts: [],
    post_request_scripts: [],
    comment: '',
    tags: '',
    folder_id: null,
    sort_order: 0,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides
  } as SavedRequest;
}

/**
 * Builds a minimal markdown document fixture for filter tests.
 *
 * @param overrides - Fields to merge onto the base document.
 */
function makeDocument(
  overrides: Partial<CollectionDocument> & Pick<CollectionDocument, 'id' | 'collection_id'>
): CollectionDocument {
  return {
    uuid: `doc-${overrides.id}`,
    folder_id: null,
    name: `Document ${overrides.id}.md`,
    content: '',
    sort_order: 0,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides
  };
}

/**
 * Builds a filter input fixture with two collections across storage locations.
 */
function makeInput(): CollectionsFilterInput {
  return {
    primaryConnectionId: 'local-sqlite',
    collections: [
      makeCollection({ id: 1, connectionId: 'local-sqlite', color: '#b91c1c' }),
      makeCollection({ id: 2, connectionId: 'remote-pg', name: 'Remote' })
    ],
    foldersByCollection: {
      1: [makeFolder({ id: 10, collection_id: 1, color: '#0d9488' })],
      2: [makeFolder({ id: 20, collection_id: 2 })]
    },
    requestsByCollection: {
      1: [
        makeRequest({ id: 100, collection_id: 1, method: 'GET', folder_id: null }),
        makeRequest({
          id: 101,
          collection_id: 1,
          method: 'POST',
          folder_id: 10,
          color: '#3b82f6'
        })
      ],
      2: [
        makeRequest({ id: 200, collection_id: 2, method: 'GET', folder_id: 20, color: '#B91C1C' })
      ]
    },
    documentsByCollection: {
      1: [
        makeDocument({ id: 1000, collection_id: 1, folder_id: null, color: '#9333ea' }),
        makeDocument({ id: 1001, collection_id: 1, folder_id: 10 })
      ],
      2: [makeDocument({ id: 2000, collection_id: 2, folder_id: null })]
    }
  };
}

describe('isCollectionsFilterActive', () => {
  it('returns false for the empty filter', () => {
    expect(isCollectionsFilterActive(EMPTY_COLLECTIONS_FILTER)).toBe(false);
  });

  it('returns true when any criterion is set', () => {
    expect(
      isCollectionsFilterActive({ ...EMPTY_COLLECTIONS_FILTER, storageLocationId: 'local-sqlite' })
    ).toBe(true);
    expect(isCollectionsFilterActive({ ...EMPTY_COLLECTIONS_FILTER, method: 'GET' })).toBe(true);
    expect(
      isCollectionsFilterActive({ ...EMPTY_COLLECTIONS_FILTER, documentType: 'request' })
    ).toBe(true);
    expect(isCollectionsFilterActive({ ...EMPTY_COLLECTIONS_FILTER, color: '#fff' })).toBe(true);
  });
});

describe('collectCollectionsTreeColors', () => {
  it('deduplicates colors that match case-insensitively and sorts them', () => {
    const colors = collectCollectionsTreeColors(makeInput());
    expect(colors).toEqual(['#0d9488', '#3b82f6', '#9333ea', '#b91c1c']);
  });

  it('returns an empty list when no colors are assigned', () => {
    const colors = collectCollectionsTreeColors({
      primaryConnectionId: 'local-sqlite',
      collections: [makeCollection({ id: 1 })],
      foldersByCollection: {},
      requestsByCollection: {},
      documentsByCollection: {}
    });
    expect(colors).toEqual([]);
  });
});

describe('collectCollectionsTreeStorageLocations', () => {
  const namesById = {
    'local-sqlite': 'Local SQLite',
    'remote-pg': 'Remote Postgres',
    'unused': 'Unused Provider'
  };

  it('returns only storage locations used by collections in the tree', () => {
    const locations = collectCollectionsTreeStorageLocations(
      makeInput().collections,
      'local-sqlite',
      namesById
    );
    expect(locations).toEqual([
      { id: 'local-sqlite', name: 'Local SQLite' },
      { id: 'remote-pg', name: 'Remote Postgres' }
    ]);
  });

  it('inherits the primary connection id when a collection has no connectionId', () => {
    const locations = collectCollectionsTreeStorageLocations(
      [makeCollection({ id: 3, name: 'Inherited' })],
      'local-sqlite',
      namesById
    );
    expect(locations).toEqual([{ id: 'local-sqlite', name: 'Local SQLite' }]);
  });

  it('deduplicates collections that share the same connection id', () => {
    const locations = collectCollectionsTreeStorageLocations(
      [
        makeCollection({ id: 1, connectionId: 'remote-pg' }),
        makeCollection({ id: 2, connectionId: 'remote-pg', name: 'Also remote' })
      ],
      'local-sqlite',
      namesById
    );
    expect(locations).toEqual([{ id: 'remote-pg', name: 'Remote Postgres' }]);
  });

  it('falls back to the connection id when no display name is known', () => {
    const locations = collectCollectionsTreeStorageLocations(
      [makeCollection({ id: 1, connectionId: 'orphan-conn' })],
      'local-sqlite',
      namesById
    );
    expect(locations).toEqual([{ id: 'orphan-conn', name: 'orphan-conn' }]);
  });
});

describe('buildCollectionsTreeFilter', () => {
  it('returns null when no criteria are active', () => {
    expect(buildCollectionsTreeFilter(makeInput(), EMPTY_COLLECTIONS_FILTER)).toBeNull();
  });

  it('includes entire matching collection trees for storage-location-only filters', () => {
    const criteria: CollectionsFilterCriteria = {
      ...EMPTY_COLLECTIONS_FILTER,
      storageLocationId: 'local-sqlite'
    };
    const filter = buildCollectionsTreeFilter(makeInput(), criteria);
    expect(filter).not.toBeNull();
    expect([...filter!.collectionIds]).toEqual([1]);
    expect([...filter!.folderIds].sort()).toEqual([10]);
    expect([...filter!.requestIds].sort()).toEqual([100, 101]);
    expect([...filter!.documentIds].sort()).toEqual([1000, 1001]);
  });

  it('matches collections that inherit the primary connection id', () => {
    const input: CollectionsFilterInput = {
      ...makeInput(),
      collections: [makeCollection({ id: 3, name: 'Inherited' })],
      foldersByCollection: {},
      requestsByCollection: {
        3: [makeRequest({ id: 300, collection_id: 3, method: 'GET' })]
      },
      documentsByCollection: {}
    };
    const filter = buildCollectionsTreeFilter(input, {
      ...EMPTY_COLLECTIONS_FILTER,
      storageLocationId: 'local-sqlite'
    });
    expect([...filter!.collectionIds]).toEqual([3]);
    expect([...filter!.requestIds]).toEqual([300]);
  });

  it('filters by method and includes ancestor folders and collections', () => {
    const filter = buildCollectionsTreeFilter(makeInput(), {
      ...EMPTY_COLLECTIONS_FILTER,
      method: 'POST'
    });
    expect(filter).not.toBeNull();
    expect([...filter!.requestIds]).toEqual([101]);
    expect([...filter!.folderIds]).toEqual([10]);
    expect([...filter!.collectionIds]).toEqual([1]);
    expect([...filter!.documentIds]).toEqual([]);
  });

  it('hides requests when document type is markdown', () => {
    const filter = buildCollectionsTreeFilter(makeInput(), {
      ...EMPTY_COLLECTIONS_FILTER,
      documentType: 'document'
    });
    expect([...filter!.requestIds]).toEqual([]);
    expect([...filter!.documentIds].sort()).toEqual([1000, 1001, 2000]);
    expect([...filter!.collectionIds].sort()).toEqual([1, 2]);
    expect([...filter!.folderIds]).toEqual([10]);
  });

  it('hides documents when document type is request', () => {
    const filter = buildCollectionsTreeFilter(makeInput(), {
      ...EMPTY_COLLECTIONS_FILTER,
      documentType: 'request'
    });
    expect([...filter!.documentIds]).toEqual([]);
    expect([...filter!.requestIds].sort()).toEqual([100, 101, 200]);
    expect([...filter!.collectionIds].sort()).toEqual([1, 2]);
  });

  it('matches color on items and includes ancestor folders and collections', () => {
    const filter = buildCollectionsTreeFilter(makeInput(), {
      ...EMPTY_COLLECTIONS_FILTER,
      color: '#3b82f6'
    });
    expect([...filter!.requestIds]).toEqual([101]);
    expect([...filter!.folderIds]).toEqual([10]);
    expect([...filter!.collectionIds]).toEqual([1]);
    expect([...filter!.documentIds]).toEqual([]);
  });

  it('includes collections and folders that match color directly', () => {
    const filter = buildCollectionsTreeFilter(makeInput(), {
      ...EMPTY_COLLECTIONS_FILTER,
      color: '#0d9488'
    });
    expect([...filter!.folderIds]).toEqual([10]);
    expect([...filter!.collectionIds]).toEqual([1]);
    expect([...filter!.requestIds]).toEqual([]);
    expect([...filter!.documentIds]).toEqual([]);
  });

  it('compares colors case-insensitively', () => {
    const filter = buildCollectionsTreeFilter(makeInput(), {
      ...EMPTY_COLLECTIONS_FILTER,
      color: '#b91c1c'
    });
    expect([...filter!.collectionIds].sort()).toEqual([1, 2]);
    expect([...filter!.requestIds]).toEqual([200]);
    expect([...filter!.folderIds]).toEqual([20]);
  });

  it('combines storage location and method with AND semantics', () => {
    const filter = buildCollectionsTreeFilter(makeInput(), {
      ...EMPTY_COLLECTIONS_FILTER,
      storageLocationId: 'remote-pg',
      method: 'GET'
    });
    expect([...filter!.collectionIds]).toEqual([2]);
    expect([...filter!.requestIds]).toEqual([200]);
    expect([...filter!.folderIds]).toEqual([20]);
    expect([...filter!.documentIds]).toEqual([]);
  });

  it('excludes remote GET requests when storage is local and method is GET', () => {
    const filter = buildCollectionsTreeFilter(makeInput(), {
      ...EMPTY_COLLECTIONS_FILTER,
      storageLocationId: 'local-sqlite',
      method: 'GET'
    });
    expect([...filter!.collectionIds]).toEqual([1]);
    expect([...filter!.requestIds]).toEqual([100]);
    expect([...filter!.folderIds]).toEqual([]);
  });
});
