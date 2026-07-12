import { describe, expect, it } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import type { Collection, CollectionDocument, Folder, SavedRequest } from '#/shared/types';
import collectionsReducer, {
  focusSidebarItem,
  moveContainerItemLocal,
  reorderCollectionsLocal,
  reorderContainerItemsLocal,
  reorderFoldersLocal,
  setSelectedCollectionId
} from '#/renderer/src/store/slices/collectionsSlice';
import type { CollectionsState } from '#/renderer/src/store/slices/collectionsSlice';

const baseCollection = (
  overrides: Partial<Collection> & Pick<Collection, 'id' | 'name'>
): Collection => ({
  uuid: `collection-${overrides.id}`,
  variables: [],
  headers: [],
  auth: defaultAuth(),
  pre_request_script: '',
  post_request_script: '',
  pre_request_scripts: [],
  post_request_scripts: [],
  created_at: '2026-01-01T00:00:00.000Z',
  ...overrides
});

const baseFolder = (overrides: Partial<Folder> & Pick<Folder, 'id' | 'name'>): Folder => ({
  collection_id: 1,
  uuid: `folder-${overrides.id}`,
  sort_order: 0,
  variables: [],
  headers: [],
  auth: defaultAuth(),
  pre_request_script: '',
  post_request_script: '',
  pre_request_scripts: [],
  post_request_scripts: [],
  created_at: '2026-01-01T00:00:00.000Z',
  ...overrides
});

const baseRequest = (
  overrides: Partial<SavedRequest> & Pick<SavedRequest, 'id' | 'name' | 'sort_order'>
): SavedRequest =>
  ({
    collection_id: 1,
    folder_id: null,
    method: 'GET',
    url: '/users',
    uuid: `req-${overrides.id}`,
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
    tags: [],
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides
  }) as SavedRequest;

const baseDocument = (
  overrides: Partial<CollectionDocument> & Pick<CollectionDocument, 'id' | 'name' | 'sort_order'>
): CollectionDocument => ({
  collection_id: 1,
  folder_id: null,
  content: '',
  uuid: `doc-${overrides.id}`,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...overrides
});

const reorderState = (): CollectionsState => ({
  collections: [baseCollection({ id: 1, name: 'Alpha' }), baseCollection({ id: 2, name: 'Beta' })],
  foldersByCollection: {
    1: [baseFolder({ id: 10, name: 'Folder A' }), baseFolder({ id: 11, name: 'Folder B' })]
  },
  requestsByCollection: {
    1: [
      baseRequest({ id: 101, name: 'Root A', sort_order: 0 }),
      baseRequest({ id: 102, name: 'Root B', sort_order: 1 }),
      baseRequest({ id: 201, name: 'Folder Req', sort_order: 0, folder_id: 10 })
    ]
  },
  documentsByCollection: {
    1: [baseDocument({ id: 301, name: 'README.md', sort_order: 2 })]
  },
  selectedCollectionId: null,
  selectedFolderId: null,
  collectionsListed: true
});

describe('collectionsSlice', () => {
  it('starts with no collection or folder selected', () => {
    const state = collectionsReducer(undefined, { type: 'unknown' });
    expect(state.selectedCollectionId).toBeNull();
    expect(state.selectedFolderId).toBeNull();
  });

  it('focusSidebarItem sets collection and folder ids together', () => {
    const state = collectionsReducer(undefined, focusSidebarItem({ collectionId: 3, folderId: 7 }));
    expect(state.selectedCollectionId).toBe(3);
    expect(state.selectedFolderId).toBe(7);
  });

  it('focusSidebarItem clears folder id when folderId is omitted', () => {
    let state = collectionsReducer(undefined, focusSidebarItem({ collectionId: 3, folderId: 7 }));
    state = collectionsReducer(state, focusSidebarItem({ collectionId: 5 }));
    expect(state.selectedCollectionId).toBe(5);
    expect(state.selectedFolderId).toBeNull();
  });

  it('setSelectedCollectionId clears folder selection', () => {
    let state = collectionsReducer(undefined, focusSidebarItem({ collectionId: 3, folderId: 7 }));
    state = collectionsReducer(state, setSelectedCollectionId(3));
    expect(state.selectedCollectionId).toBe(3);
    expect(state.selectedFolderId).toBeNull();
  });

  it('reorderCollectionsLocal reorders collections to match the payload', () => {
    const state = collectionsReducer(
      reorderState(),
      reorderCollectionsLocal({ orderedCollectionIds: [2, 1] })
    );

    expect(state.collections.map((collection) => collection.id)).toEqual([2, 1]);
  });

  it('reorderCollectionsLocal ignores invalid reorder payloads', () => {
    const initial = reorderState();
    const state = collectionsReducer(
      initial,
      reorderCollectionsLocal({ orderedCollectionIds: [1] })
    );

    expect(state.collections.map((collection) => collection.id)).toEqual(
      initial.collections.map((collection) => collection.id)
    );
  });

  it('reorderFoldersLocal reorders folders within a collection', () => {
    const state = collectionsReducer(
      reorderState(),
      reorderFoldersLocal({ collectionId: 1, orderedFolderIds: [11, 10] })
    );

    expect(state.foldersByCollection[1]?.map((folder) => folder.id)).toEqual([11, 10]);
  });

  it('reorderFoldersLocal ignores invalid reorder payloads', () => {
    const initial = reorderState();
    const state = collectionsReducer(
      initial,
      reorderFoldersLocal({ collectionId: 1, orderedFolderIds: [10] })
    );

    expect(state.foldersByCollection[1]?.map((folder) => folder.id)).toEqual(
      initial.foldersByCollection[1]?.map((folder) => folder.id)
    );
  });

  it('reorderContainerItemsLocal rewrites sort_order for merged container items', () => {
    const state = collectionsReducer(
      reorderState(),
      reorderContainerItemsLocal({
        collectionId: 1,
        folderId: null,
        items: [
          { kind: 'document', id: 301 },
          { kind: 'request', id: 102 },
          { kind: 'request', id: 101 }
        ]
      })
    );

    expect(state.requestsByCollection[1]?.find((request) => request.id === 101)?.sort_order).toBe(
      2
    );
    expect(state.requestsByCollection[1]?.find((request) => request.id === 102)?.sort_order).toBe(
      1
    );
    expect(
      state.documentsByCollection[1]?.find((document) => document.id === 301)?.sort_order
    ).toBe(0);
  });

  it('moveContainerItemLocal moves a request into another folder at the requested index', () => {
    const state = collectionsReducer(
      reorderState(),
      moveContainerItemLocal({
        collectionId: 1,
        kind: 'request',
        id: 101,
        targetFolderId: 10,
        index: 1
      })
    );

    const movedRequest = state.requestsByCollection[1]?.find((request) => request.id === 101);
    expect(movedRequest?.folder_id).toBe(10);
    expect(movedRequest?.sort_order).toBe(1);
    expect(state.requestsByCollection[1]?.find((request) => request.id === 201)?.sort_order).toBe(
      0
    );
    expect(state.requestsByCollection[1]?.find((request) => request.id === 102)?.sort_order).toBe(
      0
    );
  });

  it('moveContainerItemLocal moves a document into another folder and reindexes the source container', () => {
    const state = collectionsReducer(
      reorderState(),
      moveContainerItemLocal({
        collectionId: 1,
        kind: 'document',
        id: 301,
        targetFolderId: 10,
        index: 0
      })
    );

    const movedDocument = state.documentsByCollection[1]?.find((document) => document.id === 301);
    expect(movedDocument?.folder_id).toBe(10);
    expect(movedDocument?.sort_order).toBe(0);
    expect(state.requestsByCollection[1]?.find((request) => request.id === 201)?.sort_order).toBe(
      1
    );
    expect(state.requestsByCollection[1]?.find((request) => request.id === 101)?.sort_order).toBe(
      0
    );
    expect(state.requestsByCollection[1]?.find((request) => request.id === 102)?.sort_order).toBe(
      1
    );
  });

  it('reorderContainerItemsLocal reorders document-only container items', () => {
    const state = collectionsReducer(
      {
        ...reorderState(),
        documentsByCollection: {
          1: [
            baseDocument({ id: 301, name: 'Alpha.md', sort_order: 0 }),
            baseDocument({ id: 302, name: 'Beta.md', sort_order: 1 })
          ]
        }
      },
      reorderContainerItemsLocal({
        collectionId: 1,
        folderId: null,
        items: [
          { kind: 'document', id: 302 },
          { kind: 'document', id: 301 }
        ]
      })
    );

    expect(
      state.documentsByCollection[1]?.find((document) => document.id === 302)?.sort_order
    ).toBe(0);
    expect(
      state.documentsByCollection[1]?.find((document) => document.id === 301)?.sort_order
    ).toBe(1);
  });

  it('moveContainerItemLocal ignores unknown container items', () => {
    const initial = reorderState();
    const state = collectionsReducer(
      initial,
      moveContainerItemLocal({
        collectionId: 1,
        kind: 'document',
        id: 999,
        targetFolderId: 10,
        index: 0
      })
    );

    expect(state.documentsByCollection[1]).toEqual(initial.documentsByCollection[1]);
  });
});
