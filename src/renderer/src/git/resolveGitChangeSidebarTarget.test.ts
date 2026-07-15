import { describe, expect, it } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import type {
  Collection,
  CollectionDocument,
  GitRequestDiffFileEntry,
  SavedRequest
} from '#/shared/types';
import {
  gitChangePathBasename,
  parseRequestUuidFromGitFileName,
  resolveGitChangeSidebarTarget
} from './resolveGitChangeSidebarTarget';

const COLLECTION_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REQUEST_UUID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

/**
 * Builds a minimal collection row for resolver tests.
 */
function sampleCollection(overrides: Partial<Collection> = {}): Collection {
  return {
    id: 1,
    uuid: COLLECTION_UUID,
    name: 'API',
    variables: [],
    headers: [],
    auth: defaultAuth(),
    pre_request_script: '',
    post_request_script: '',
    pre_request_scripts: [],
    post_request_scripts: [],
    created_at: '2026-01-01T00:00:00.000Z',
    connectionId: 'git-1',
    ...overrides
  };
}

/**
 * Builds a minimal saved request row for resolver tests.
 */
function sampleRequest(overrides: Partial<SavedRequest> = {}): SavedRequest {
  return {
    id: 42,
    collection_id: 1,
    folder_id: null,
    uuid: REQUEST_UUID,
    name: 'Health',
    method: 'GET',
    url: 'https://example.com/health',
    headers: [],
    params: [],
    body: '',
    body_type: 'none',
    pre_request_script: '',
    post_request_script: '',
    pre_request_scripts: [],
    post_request_scripts: [],
    comment: '',
    tags: '',
    auth: defaultAuth(),
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

/**
 * Builds a minimal markdown document row for resolver tests.
 */
function sampleDocument(overrides: Partial<CollectionDocument> = {}): CollectionDocument {
  return {
    id: 7,
    collection_id: 1,
    folder_id: 3,
    uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    name: 'README.md',
    content: '# Docs',
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

/**
 * Builds a minimal git diff file entry for resolver tests.
 */
function sampleFileEntry(
  overrides: Partial<GitRequestDiffFileEntry> = {}
): GitRequestDiffFileEntry {
  return {
    path: `.harborclient/collection-api/req-${REQUEST_UUID}.json`,
    status: 'modified',
    binary: false,
    truncated: false,
    hasConflict: false,
    resourceKind: 'request',
    ...overrides
  };
}

describe('gitChangePathBasename', () => {
  it('returns the final path segment from repository-relative paths', () => {
    expect(gitChangePathBasename('.harborclient/collection-api/req-health.json')).toBe(
      'req-health.json'
    );
  });
});

describe('parseRequestUuidFromGitFileName', () => {
  it('parses canonical request file names', () => {
    expect(parseRequestUuidFromGitFileName(`req-${REQUEST_UUID}.json`)).toBe(REQUEST_UUID);
  });

  it('returns null for non-request file names', () => {
    expect(parseRequestUuidFromGitFileName('README.md')).toBeNull();
  });
});

describe('resolveGitChangeSidebarTarget', () => {
  it('resolves a request change to the matching saved request row', () => {
    const target = resolveGitChangeSidebarTarget(sampleFileEntry(), COLLECTION_UUID, {
      collections: [sampleCollection()],
      requestsByCollection: { 1: [sampleRequest({ folder_id: 9 })] },
      documentsByCollection: {}
    });

    expect(target).toEqual({
      collectionId: 1,
      folderId: 9,
      kind: 'request',
      id: 42
    });
  });

  it('resolves a markdown change to the matching document row', () => {
    const target = resolveGitChangeSidebarTarget(
      sampleFileEntry({
        path: '.harborclient/README.md',
        resourceKind: 'document',
        method: undefined,
        displayName: 'README.md'
      }),
      COLLECTION_UUID,
      {
        collections: [sampleCollection()],
        requestsByCollection: {},
        documentsByCollection: { 1: [sampleDocument()] }
      }
    );

    expect(target).toEqual({
      collectionId: 1,
      folderId: 3,
      kind: 'document',
      id: 7
    });
  });

  it('resolves a disambiguated harbor-root markdown path via displayName', () => {
    const target = resolveGitChangeSidebarTarget(
      sampleFileEntry({
        path: '.harborclient/README-api.md',
        resourceKind: 'document',
        method: undefined,
        displayName: 'README.md'
      }),
      COLLECTION_UUID,
      {
        collections: [sampleCollection()],
        requestsByCollection: {},
        documentsByCollection: { 1: [sampleDocument()] }
      }
    );

    expect(target).toEqual({
      collectionId: 1,
      folderId: 3,
      kind: 'document',
      id: 7
    });
  });

  it('returns null when the collection uuid does not match', () => {
    expect(
      resolveGitChangeSidebarTarget(sampleFileEntry(), 'missing-uuid', {
        collections: [sampleCollection()],
        requestsByCollection: { 1: [sampleRequest()] },
        documentsByCollection: {}
      })
    ).toBeNull();
  });

  it('returns null when the request no longer exists in the store', () => {
    expect(
      resolveGitChangeSidebarTarget(sampleFileEntry(), COLLECTION_UUID, {
        collections: [sampleCollection()],
        requestsByCollection: { 1: [] },
        documentsByCollection: {}
      })
    ).toBeNull();
  });

  it('returns null for non request/document resource kinds', () => {
    expect(
      resolveGitChangeSidebarTarget(sampleFileEntry({ resourceKind: undefined }), COLLECTION_UUID, {
        collections: [sampleCollection()],
        requestsByCollection: { 1: [sampleRequest()] },
        documentsByCollection: {}
      })
    ).toBeNull();
  });
});
