import { describe, expect, it } from 'vitest';
import { defaultAuth } from '@harborclient/core/auth';
import type { Collection } from '@harborclient/core/types';
import { resolveActiveCollectionTargetId } from './resolveActiveCollectionTargetId';

/**
 * Builds a minimal collection fixture for target-id resolution tests.
 *
 * @param id - Collection id.
 * @param name - Display name.
 * @param archived - Whether the collection is archived.
 */
function sampleCollection(id: number, name: string, archived = false): Collection {
  return {
    id,
    uuid: `uuid-${id}`,
    name,
    variables: [],
    headers: [],
    auth: defaultAuth(),
    userAgent: '',
    pre_request_script: '',
    post_request_script: '',
    pre_request_scripts: [],
    post_request_scripts: [],
    created_at: '2026-01-01T00:00:00.000Z',
    archived
  };
}

describe('resolveActiveCollectionTargetId', () => {
  const collections = [
    sampleCollection(1, 'Active'),
    sampleCollection(2, 'Google', true),
    sampleCollection(3, 'Other')
  ];

  it('returns null when the candidate is null or undefined', () => {
    expect(resolveActiveCollectionTargetId(collections, null)).toBeNull();
    expect(resolveActiveCollectionTargetId(collections, undefined)).toBeNull();
  });

  it('returns null when the candidate is missing from the list', () => {
    expect(resolveActiveCollectionTargetId(collections, 99)).toBeNull();
  });

  it('returns null when the candidate collection is archived', () => {
    expect(resolveActiveCollectionTargetId(collections, 2)).toBeNull();
  });

  it('returns the candidate when the collection exists and is active', () => {
    expect(resolveActiveCollectionTargetId(collections, 1)).toBe(1);
    expect(resolveActiveCollectionTargetId(collections, 3)).toBe(3);
  });
});
