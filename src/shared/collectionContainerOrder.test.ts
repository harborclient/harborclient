import { describe, expect, it } from 'vitest';
import { compareContainerItems, mergeContainerItems } from './collectionContainerOrder';
import type { CollectionDocument, SavedRequest } from './types';

const baseDocument = (
  overrides: Partial<CollectionDocument> & Pick<CollectionDocument, 'id' | 'name' | 'sort_order'>
): CollectionDocument => ({
  collection_id: 10,
  folder_id: null,
  content: '',
  uuid: `doc-${overrides.id}`,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...overrides
});

const baseRequest = (
  overrides: Partial<SavedRequest> & Pick<SavedRequest, 'id' | 'name' | 'sort_order'>
): SavedRequest =>
  ({
    collection_id: 10,
    folder_id: null,
    method: 'GET',
    url: '/users',
    uuid: `req-${overrides.id}`,
    headers: [],
    params: [],
    auth: { type: 'none' },
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

describe('mergeContainerItems', () => {
  it('interleaves items by shared sort_order values', () => {
    const requests = [
      baseRequest({ id: 1, name: 'B', sort_order: 2 }),
      baseRequest({ id: 2, name: 'A', sort_order: 0 })
    ];
    const documents = [baseDocument({ id: 3, name: 'README.md', sort_order: 1 })];

    expect(mergeContainerItems(requests, documents, null).map((item) => item.id)).toEqual([
      2, 3, 1
    ]);
  });

  it('keeps requests before documents when sort_order ties', () => {
    const requests = [baseRequest({ id: 1, name: 'Req', sort_order: 0 })];
    const documents = [baseDocument({ id: 2, name: 'Doc', sort_order: 0 })];

    expect(mergeContainerItems(requests, documents, null).map((item) => item.kind)).toEqual([
      'request',
      'document'
    ]);
  });
});

describe('compareContainerItems', () => {
  it('sorts by name within the same kind and sort_order', () => {
    expect(
      compareContainerItems(
        { kind: 'request', id: 1, sort_order: 0, name: 'B' },
        { kind: 'request', id: 2, sort_order: 0, name: 'A' }
      )
    ).toBeGreaterThan(0);
  });
});
