import { describe, expect, it } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import type { CollectionDocument, SavedRequest } from '#/shared/types';
import { mergeContainerItems } from '#/shared/collectionContainerOrder';
import {
  documentDragId,
  findUnifiedIndex,
  parseDragId,
  resolveDocumentDropTarget
} from '#/renderer/src/ui/sidebars/CollectionSidebar/Collections/utils';

describe('documentDragId', () => {
  it('builds a stable sortable id', () => {
    expect(documentDragId(42)).toBe('document:42');
  });
});

describe('parseDragId', () => {
  it('parses a valid document drag id', () => {
    expect(parseDragId('document:42')).toEqual({ kind: 'document', id: 42 });
  });

  it('returns null for invalid drag ids', () => {
    expect(parseDragId('markdown:42')).toBeNull();
    expect(parseDragId('document:')).toBeNull();
  });
});

describe('resolveDocumentDropTarget', () => {
  const documents = [
    {
      id: 1,
      collection_id: 10,
      folder_id: null,
      name: 'README.md',
      content: '',
      sort_order: 0,
      uuid: 'doc-1',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 2,
      collection_id: 10,
      folder_id: 5,
      name: 'notes.md',
      content: '',
      sort_order: 0,
      uuid: 'doc-2',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z'
    }
  ] satisfies CollectionDocument[];

  const requests = [
    {
      id: 99,
      collection_id: 10,
      folder_id: 5,
      name: 'Get users',
      method: 'GET',
      url: '/users',
      sort_order: 0,
      uuid: 'req-99'
    }
  ] as SavedRequest[];

  it('resolves collection root drop zones', () => {
    expect(resolveDocumentDropTarget('drop:root:10', documents, requests)).toBeNull();
  });

  it('resolves folder drop zones', () => {
    expect(resolveDocumentDropTarget('drop:folder:5', documents, requests)).toBe(5);
  });

  it('inherits folder placement from another document', () => {
    expect(resolveDocumentDropTarget('document:2', documents, requests)).toBe(5);
  });

  it('inherits folder placement from a request row', () => {
    expect(resolveDocumentDropTarget('request:99', documents, requests)).toBe(5);
  });

  it('returns undefined for unknown targets', () => {
    expect(resolveDocumentDropTarget('collection:10', documents, requests)).toBeUndefined();
  });
});

describe('findUnifiedIndex', () => {
  const items = mergeContainerItems(
    [
      {
        id: 1,
        collection_id: 10,
        folder_id: null,
        name: 'Get users',
        method: 'GET',
        url: '/users',
        sort_order: 0,
        uuid: 'req-1',
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
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z'
      } as SavedRequest
    ],
    [
      {
        id: 2,
        collection_id: 10,
        folder_id: null,
        name: 'README.md',
        content: '',
        sort_order: 1,
        uuid: 'doc-2',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z'
      }
    ],
    null
  ).map(({ kind, id }) => ({ kind, id }));

  it('returns the index of a hovered request row', () => {
    expect(findUnifiedIndex(items, 'request:1')).toBe(0);
  });

  it('returns the index of a hovered document row', () => {
    expect(findUnifiedIndex(items, 'document:2')).toBe(1);
  });

  it('appends to the end for drop zones', () => {
    expect(findUnifiedIndex(items, 'drop:root:10')).toBe(items.length);
  });
});
