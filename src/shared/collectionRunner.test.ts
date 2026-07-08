import { describe, expect, it } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import {
  buildPendingCollectionRunnerResults,
  buildRunResultsExport,
  DEFAULT_COLLECTION_RUNNER_CONFIG,
  getCollectionRunnerRequests,
  getRequestsInRunOrder,
  isCollectionRunnerRequestFailure,
  normalizeCollectionRunnerConfig,
  resolveCollectionRunnerNextIndex,
  summarizeRunnerResults
} from '#/shared/collectionRunner';
import type { Folder, SavedRequest } from '#/shared/types';

/**
 * Builds a minimal saved request fixture for collection runner tests.
 */
function sampleRequest(
  overrides: Partial<SavedRequest> & Pick<SavedRequest, 'id' | 'name' | 'sort_order'>
): SavedRequest {
  return {
    uuid: 'uuid',
    collection_id: 1,
    folder_id: null,
    method: 'GET',
    url: 'https://example.com',
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
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

describe('normalizeCollectionRunnerConfig', () => {
  it('returns defaults for empty input', () => {
    expect(normalizeCollectionRunnerConfig(undefined)).toEqual(DEFAULT_COLLECTION_RUNNER_CONFIG);
  });

  it('clamps invalid delay and clears override environment when mode is active', () => {
    expect(
      normalizeCollectionRunnerConfig({
        delayMs: -5,
        stopOnFailure: true,
        environmentMode: 'active',
        environmentId: 99
      })
    ).toEqual({
      delayMs: 0,
      stopOnFailure: true,
      environmentMode: 'active',
      environmentId: null
    });
  });

  it('keeps override environment id when mode is override', () => {
    expect(
      normalizeCollectionRunnerConfig({
        environmentMode: 'override',
        environmentId: 3
      }).environmentId
    ).toBe(3);
  });
});

describe('getRequestsInRunOrder', () => {
  const folders: Folder[] = [
    {
      id: 10,
      collection_id: 1,
      uuid: 'f1',
      name: 'Folder A',
      sort_order: 0,
      created_at: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 11,
      collection_id: 1,
      uuid: 'f2',
      name: 'Folder B',
      sort_order: 1,
      created_at: '2026-01-01T00:00:00.000Z'
    }
  ];

  const requests: SavedRequest[] = [
    sampleRequest({ id: 1, name: 'Root B', sort_order: 1, folder_id: null }),
    sampleRequest({ id: 2, name: 'Root A', sort_order: 0, folder_id: null }),
    sampleRequest({ id: 3, name: 'In A-2', sort_order: 1, folder_id: 10 }),
    sampleRequest({ id: 4, name: 'In A-1', sort_order: 0, folder_id: 10 }),
    sampleRequest({ id: 5, name: 'In B', sort_order: 0, folder_id: 11 })
  ];

  it('orders a full collection by root then folders', () => {
    const order = getRequestsInRunOrder(1, null, requests, folders).map((request) => request.id);
    expect(order).toEqual([2, 1, 4, 3, 5]);
  });

  it('orders a single folder only', () => {
    const order = getRequestsInRunOrder(1, 10, requests, folders).map((request) => request.id);
    expect(order).toEqual([4, 3]);
  });
});

describe('getCollectionRunnerRequests', () => {
  const folders: Folder[] = [
    {
      id: 10,
      collection_id: 1,
      uuid: 'f1',
      name: 'Folder A',
      sort_order: 0,
      created_at: '2026-01-01T00:00:00.000Z'
    }
  ];

  const requests: SavedRequest[] = [
    sampleRequest({ id: 1, name: 'Root', sort_order: 0, folder_id: null }),
    sampleRequest({ id: 2, name: 'In folder', sort_order: 0, folder_id: 10 })
  ];

  it('returns a single matching request when requestId is set', () => {
    expect(
      getCollectionRunnerRequests(1, null, 2, requests, folders).map((request) => request.id)
    ).toEqual([2]);
  });

  it('returns an empty list when requestId is missing from the collection', () => {
    expect(getCollectionRunnerRequests(1, null, 99, requests, folders)).toEqual([]);
  });

  it('falls back to collection run order when requestId is null', () => {
    expect(
      getCollectionRunnerRequests(1, null, null, requests, folders).map((request) => request.id)
    ).toEqual([1, 2]);
  });
});

describe('isCollectionRunnerRequestFailure', () => {
  it('treats HTTP errors, 4xx/5xx, and failed tests as failures', () => {
    expect(isCollectionRunnerRequestFailure({ status: 0, error: 'Network error' }, [])).toBe(true);
    expect(isCollectionRunnerRequestFailure({ status: 404 }, [])).toBe(true);
    expect(
      isCollectionRunnerRequestFailure({ status: 200 }, [
        { name: 'ok', passed: true },
        { name: 'bad', passed: false }
      ])
    ).toBe(true);
    expect(isCollectionRunnerRequestFailure({ status: 200 }, [])).toBe(false);
  });
});

describe('buildPendingCollectionRunnerResults', () => {
  it('creates pending rows for each request', () => {
    const requests = [
      sampleRequest({ id: 1, name: 'One', sort_order: 0 }),
      sampleRequest({ id: 2, name: 'Two', sort_order: 1 })
    ];
    expect(buildPendingCollectionRunnerResults(requests)).toEqual([
      {
        requestId: 1,
        requestName: 'One',
        requestMethod: 'GET',
        status: 'pending',
        testsPassed: 0,
        testsFailed: 0
      },
      {
        requestId: 2,
        requestName: 'Two',
        requestMethod: 'GET',
        status: 'pending',
        testsPassed: 0,
        testsFailed: 0
      }
    ]);
  });

  it('copies each request method into pending rows', () => {
    const requests = [
      sampleRequest({ id: 1, name: 'Create', sort_order: 0, method: 'POST' }),
      sampleRequest({ id: 2, name: 'Remove', sort_order: 1, method: 'DELETE' })
    ];
    expect(buildPendingCollectionRunnerResults(requests).map((row) => row.requestMethod)).toEqual([
      'POST',
      'DELETE'
    ]);
  });
});

describe('resolveCollectionRunnerNextIndex', () => {
  const requests = [
    sampleRequest({ id: 1, name: 'Login', sort_order: 0 }),
    sampleRequest({ id: 2, name: 'Profile', sort_order: 1 }),
    sampleRequest({ id: 3, name: 'Logout', sort_order: 2 })
  ];

  it('advances sequentially when no directive is set', () => {
    expect(resolveCollectionRunnerNextIndex(requests, 0, undefined)).toBe(1);
    expect(resolveCollectionRunnerNextIndex(requests, 2, undefined)).toBeNull();
  });

  it('jumps to a named request when setNextRequest matches', () => {
    expect(resolveCollectionRunnerNextIndex(requests, 0, 'Logout')).toBe(2);
  });

  it('stops the run when setNextRequest is null', () => {
    expect(resolveCollectionRunnerNextIndex(requests, 0, null)).toBeNull();
  });
});

describe('summarizeRunnerResults', () => {
  it('counts passed, failed, and skipped rows', () => {
    expect(
      summarizeRunnerResults([
        {
          requestId: 1,
          requestName: 'A',
          requestMethod: 'GET',
          status: 'passed',
          testsPassed: 1,
          testsFailed: 0
        },
        {
          requestId: 2,
          requestName: 'B',
          requestMethod: 'GET',
          status: 'failed',
          testsPassed: 0,
          testsFailed: 1
        },
        {
          requestId: 3,
          requestName: 'C',
          requestMethod: 'GET',
          status: 'skipped',
          testsPassed: 0,
          testsFailed: 0
        }
      ])
    ).toEqual({ passed: 1, failed: 1, skipped: 1 });
  });
});

describe('buildRunResultsExport', () => {
  const results = [
    {
      requestId: 1,
      requestName: 'Health',
      requestMethod: 'GET' as const,
      status: 'passed' as const,
      testsPassed: 1,
      testsFailed: 0,
      response: {
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '{}',
        timeMs: 5,
        sizeBytes: 2
      }
    }
  ];

  it('builds a collection run export with collection metadata', () => {
    const payload = buildRunResultsExport({
      requestId: null,
      collectionName: 'Demo API',
      folderName: null,
      requestName: null,
      collectionUuid: '550e8400-e29b-41d4-a716-446655440000',
      requestUuid: null,
      requestMethod: null,
      delayMs: 100,
      stopOnFailure: true,
      environmentMode: 'override',
      environmentId: 3,
      environmentName: 'Staging',
      results
    });

    expect(payload.harborclientExport).toBe('collection-run-results');
    expect(payload.delay).toBe(100);
    expect(payload.stopOnFailure).toBe(true);
    expect(payload.environment).toEqual({ mode: 'override', id: 3, name: 'Staging' });
    expect(payload.collection?.uuid).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(payload.results).toEqual(results);
  });

  it('builds a request run export with request metadata', () => {
    const payload = buildRunResultsExport({
      requestId: 42,
      collectionName: 'Demo API',
      folderName: null,
      requestName: 'Health',
      collectionUuid: '550e8400-e29b-41d4-a716-446655440000',
      requestUuid: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      requestMethod: 'GET',
      delayMs: 0,
      stopOnFailure: false,
      environmentMode: 'active',
      environmentId: null,
      environmentName: 'Active environment',
      results
    });

    expect(payload.harborclientExport).toBe('request-run-results');
    expect(payload.request).toEqual({
      uuid: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      name: 'Health',
      method: 'GET'
    });
  });
});
