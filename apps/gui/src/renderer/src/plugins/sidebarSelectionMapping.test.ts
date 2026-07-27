import { describe, expect, it } from 'vitest';
import type { SidebarSelection } from '@harborclient/sdk';
import type { RootState } from '#/renderer/src/store/redux';
import {
  selectionFromState,
  selectionsEqual,
  sidebarFocusPayloadForDocument,
  sidebarFocusPayloadForRequest,
  validateSidebarSelection
} from './sidebarSelectionMapping';

/**
 * Builds a minimal root-state stub for selection derivation tests.
 *
 * @param overrides - Partial collections/tabs state.
 */
function stubState(overrides: {
  selectedCollectionId?: number | null;
  selectedFolderId?: number | null;
  tabs?: RootState['tabs']['tabs'];
  activeTabId?: string | null;
}): RootState {
  return {
    collections: {
      collections: [],
      foldersByCollection: {},
      requestsByCollection: {},
      documentsByCollection: {},
      selectedCollectionId: overrides.selectedCollectionId ?? null,
      selectedFolderId: overrides.selectedFolderId ?? null,
      collectionsListed: true
    },
    tabs: {
      tabs: overrides.tabs ?? [],
      activeTabId: overrides.activeTabId ?? null
    }
  } as unknown as RootState;
}

describe('sidebarFocusPayload helpers', () => {
  it('maps request and document parent ids for focusSidebarItem', () => {
    expect(sidebarFocusPayloadForRequest({ collection_id: 10, folder_id: 3 })).toEqual({
      collectionId: 10,
      folderId: 3
    });
    expect(sidebarFocusPayloadForDocument({ collection_id: 10, folder_id: null })).toEqual({
      collectionId: 10,
      folderId: null
    });
  });
});

describe('selectionFromState', () => {
  it('returns null when nothing is selected', () => {
    expect(selectionFromState(stubState({}))).toBeNull();
  });

  it('returns collection selection when only a collection is highlighted', () => {
    expect(
      selectionFromState(stubState({ selectedCollectionId: 7, selectedFolderId: null }))
    ).toEqual({ kind: 'collection', collectionId: 7 });
  });

  it('returns folder selection when a folder is highlighted', () => {
    expect(selectionFromState(stubState({ selectedCollectionId: 7, selectedFolderId: 2 }))).toEqual(
      { kind: 'folder', collectionId: 7, folderId: 2 }
    );
  });

  it('prefers the active saved request tab over folder highlight', () => {
    expect(
      selectionFromState(
        stubState({
          selectedCollectionId: 7,
          selectedFolderId: 2,
          activeTabId: 't1',
          tabs: [
            {
              tabId: 't1',
              draft: {
                id: 99,
                collection_id: 7,
                folder_id: 2,
                name: 'Get',
                method: 'GET',
                url: ''
              }
            } as never
          ]
        })
      )
    ).toEqual({
      kind: 'request',
      collectionId: 7,
      folderId: 2,
      requestId: 99
    });
  });

  it('prefers the active markdown tab over collection highlight', () => {
    expect(
      selectionFromState(
        stubState({
          selectedCollectionId: 7,
          activeTabId: 'm1',
          tabs: [
            {
              tabId: 'm1',
              kind: 'markdown',
              docId: 55,
              collectionId: 7,
              folderId: null,
              name: 'readme.md',
              content: '',
              savedContent: ''
            } as never
          ]
        })
      )
    ).toEqual({
      kind: 'document',
      collectionId: 7,
      folderId: null,
      documentId: 55
    });
  });
});

describe('selectionsEqual', () => {
  it('compares null and matching kinds', () => {
    expect(selectionsEqual(null, null)).toBe(true);
    expect(selectionsEqual(null, { kind: 'collection', collectionId: 1 })).toBe(false);
    const a: SidebarSelection = { kind: 'folder', collectionId: 1, folderId: 2 };
    expect(selectionsEqual(a, { kind: 'folder', collectionId: 1, folderId: 2 })).toBe(true);
    expect(selectionsEqual(a, { kind: 'folder', collectionId: 1, folderId: 3 })).toBe(false);
  });
});

describe('validateSidebarSelection', () => {
  it('accepts null and valid unions', () => {
    expect(validateSidebarSelection(null)).toBeNull();
    expect(validateSidebarSelection({ kind: 'collection', collectionId: 1 })).toEqual({
      kind: 'collection',
      collectionId: 1
    });
    expect(
      validateSidebarSelection({
        kind: 'request',
        collectionId: 1,
        folderId: null,
        requestId: 9
      })
    ).toEqual({
      kind: 'request',
      collectionId: 1,
      folderId: null,
      requestId: 9
    });
  });

  it('rejects invalid payloads', () => {
    expect(() => validateSidebarSelection({})).toThrow(/kind/);
    expect(() => validateSidebarSelection({ kind: 'collection' })).toThrow(/collectionId/);
    expect(() => validateSidebarSelection({ kind: 'widget', collectionId: 1 })).toThrow(/unknown/);
  });
});
