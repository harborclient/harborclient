import { describe, expect, it } from 'vitest';
import type { CollectionDocument, SavedRequest } from '#/shared/types';
import {
  collectionHasDeselectableSelection,
  removeCollectionRequestSelection
} from './collectionSidebarSelection';

const requestsByCollection: Record<number, SavedRequest[]> = {
  1: [{ id: 10, collection_id: 1 } as SavedRequest, { id: 11, collection_id: 1 } as SavedRequest],
  2: [{ id: 20, collection_id: 2 } as SavedRequest]
};

const documentsByCollection: Record<number, CollectionDocument[]> = {
  1: [{ id: 100, collection_id: 1 } as CollectionDocument],
  2: [{ id: 200, collection_id: 2 } as CollectionDocument]
};

describe('collectionHasDeselectableSelection', () => {
  it('returns true when a folder in the collection is selected', () => {
    expect(
      collectionHasDeselectableSelection(1, {
        selectedCollectionId: 1,
        selectedFolderId: 7,
        selectedRequestIds: new Set(),
        requestsByCollection,
        documentsByCollection,
        openRequestIds: new Set(),
        openDocumentIds: new Set()
      })
    ).toBe(true);
  });

  it('returns true when multi-selected requests belong to the collection', () => {
    expect(
      collectionHasDeselectableSelection(1, {
        selectedCollectionId: null,
        selectedFolderId: null,
        selectedRequestIds: new Set([10, 20]),
        requestsByCollection,
        documentsByCollection,
        openRequestIds: new Set(),
        openDocumentIds: new Set()
      })
    ).toBe(true);
  });

  it('returns true when open request or markdown tabs belong to the collection', () => {
    expect(
      collectionHasDeselectableSelection(1, {
        selectedCollectionId: null,
        selectedFolderId: null,
        selectedRequestIds: new Set(),
        requestsByCollection,
        documentsByCollection,
        openRequestIds: new Set([10]),
        openDocumentIds: new Set()
      })
    ).toBe(true);

    expect(
      collectionHasDeselectableSelection(1, {
        selectedCollectionId: null,
        selectedFolderId: null,
        selectedRequestIds: new Set(),
        requestsByCollection,
        documentsByCollection,
        openRequestIds: new Set(),
        openDocumentIds: new Set([100])
      })
    ).toBe(true);
  });

  it('returns false when only the collection row is highlighted', () => {
    expect(
      collectionHasDeselectableSelection(1, {
        selectedCollectionId: 1,
        selectedFolderId: null,
        selectedRequestIds: new Set(),
        requestsByCollection,
        documentsByCollection,
        openRequestIds: new Set(),
        openDocumentIds: new Set()
      })
    ).toBe(false);
  });

  it('returns false when selection belongs to another collection only', () => {
    expect(
      collectionHasDeselectableSelection(1, {
        selectedCollectionId: 2,
        selectedFolderId: 8,
        selectedRequestIds: new Set([20]),
        requestsByCollection,
        documentsByCollection,
        openRequestIds: new Set([20]),
        openDocumentIds: new Set([200])
      })
    ).toBe(false);
  });
});

describe('removeCollectionRequestSelection', () => {
  it('removes only request ids from the target collection', () => {
    expect(
      removeCollectionRequestSelection(1, new Set([10, 11, 20]), 10, requestsByCollection)
    ).toEqual({
      selectedRequestIds: new Set([20]),
      selectionAnchorId: null
    });
  });

  it('preserves the anchor when it is outside the cleared collection', () => {
    expect(
      removeCollectionRequestSelection(1, new Set([10, 20]), 20, requestsByCollection)
    ).toEqual({
      selectedRequestIds: new Set([20]),
      selectionAnchorId: 20
    });
  });
});
