import { describe, expect, it } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import {
  buildPendingCollectionRunnerResults,
  DEFAULT_COLLECTION_RUNNER_CONFIG,
  getRequestsInRunOrder,
  isCollectionRunnerRequestFailure,
  normalizeCollectionRunnerConfig
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
    comment: '',
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
        status: 'pending',
        testsPassed: 0,
        testsFailed: 0
      },
      {
        requestId: 2,
        requestName: 'Two',
        status: 'pending',
        testsPassed: 0,
        testsFailed: 0
      }
    ]);
  });
});
