import { describe, expect, it } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import { resolveGitSidebarCollectionId } from '#/renderer/src/git/resolveCollectionGitContext';
import collectionsReducer, { focusSidebarItem } from '#/renderer/src/store/slices/collectionsSlice';
import {
  sidebarFocusPayloadForDocument,
  sidebarFocusPayloadForRequest
} from '#/renderer/src/ui/sidebars/CollectionSidebar/useCollectionActions';
import type { CollectionDocument, SavedRequest } from '#/shared/types';

/**
 * Returns a minimal saved request for sidebar focus tests.
 *
 * @param overrides - Fields to override on the base request.
 */
function sampleRequest(overrides: Partial<SavedRequest> = {}): SavedRequest {
  return {
    id: 1,
    uuid: 'req-uuid',
    name: 'Get users',
    collection_id: 10,
    folder_id: 3,
    method: 'GET',
    url: 'https://example.com/users',
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
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

/**
 * Returns a minimal markdown document for sidebar focus tests.
 *
 * @param overrides - Fields to override on the base document.
 */
function sampleDocument(overrides: Partial<CollectionDocument> = {}): CollectionDocument {
  return {
    id: 2,
    uuid: 'doc-uuid',
    name: 'Notes.md',
    collection_id: 20,
    folder_id: null,
    content: '# Notes',
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

describe('sidebarFocusPayloadForRequest', () => {
  it('maps a saved request to its parent collection and folder', () => {
    expect(sidebarFocusPayloadForRequest(sampleRequest())).toEqual({
      collectionId: 10,
      folderId: 3
    });
  });

  it('normalizes a null folder id to null for collection-root requests', () => {
    expect(sidebarFocusPayloadForRequest(sampleRequest({ folder_id: null }))).toEqual({
      collectionId: 10,
      folderId: null
    });
  });
});

describe('sidebarFocusPayloadForDocument', () => {
  it('maps a markdown document to its parent collection and folder', () => {
    expect(sidebarFocusPayloadForDocument(sampleDocument({ folder_id: 8 }))).toEqual({
      collectionId: 20,
      folderId: 8
    });
  });

  it('normalizes a null folder id to null for collection-root documents', () => {
    expect(sidebarFocusPayloadForDocument(sampleDocument())).toEqual({
      collectionId: 20,
      folderId: null
    });
  });
});

describe('sidebar item focus and git sidebar resolution', () => {
  it('updates git sidebar target collection when item focus is applied', () => {
    const payload = sidebarFocusPayloadForRequest(sampleRequest({ collection_id: 42 }));
    const state = collectionsReducer(undefined, focusSidebarItem(payload));

    expect(state.selectedCollectionId).toBe(42);
    expect(resolveGitSidebarCollectionId(state.selectedCollectionId, undefined)).toBe(42);
  });
});
