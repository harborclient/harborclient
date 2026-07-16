import { describe, expect, it } from 'vitest';
import type { RequestHistoryEntry } from '#/shared/types/requestHistory';
import type { SavedRequest } from '#/shared/types';
import { historyEntryCollectionId } from './historyEntryCollection';

/**
 * Builds a minimal request history entry for collection-resolution tests.
 *
 * @param overrides - Fields to merge onto the default entry.
 * @returns A request history entry suitable for unit tests.
 */
function historyEntry(overrides: Partial<RequestHistoryEntry> = {}): RequestHistoryEntry {
  return {
    id: 1,
    method: 'GET',
    url: 'https://example.com',
    status: 200,
    statusText: 'OK',
    ts: 1,
    ...overrides
  };
}

/**
 * Builds a minimal saved request for collection-resolution tests.
 *
 * @param id - Saved request id.
 * @returns A saved request stub with the given id.
 */
function savedRequest(id: number): SavedRequest {
  return { id } as SavedRequest;
}

describe('historyEntryCollectionId', () => {
  it('returns runCollectionId for run entries', () => {
    const entry = historyEntry({
      kind: 'run',
      runCollectionId: 42,
      name: 'My collection'
    });

    expect(historyEntryCollectionId(entry, {})).toBe(42);
  });

  it('returns null for run entries without a collection id', () => {
    const entry = historyEntry({ kind: 'run', name: 'Orphan run' });

    expect(historyEntryCollectionId(entry, {})).toBeNull();
  });

  it('resolves request entries via savedRequestId in the requests cache', () => {
    const entry = historyEntry({ savedRequestId: 7 });
    const requestsByCollection = {
      10: [savedRequest(7)],
      11: [savedRequest(8)]
    };

    expect(historyEntryCollectionId(entry, requestsByCollection)).toBe(10);
  });

  it('returns null for request entries with no saved request id', () => {
    expect(historyEntryCollectionId(historyEntry(), {})).toBeNull();
  });

  it('returns null when the saved request is not loaded in any collection', () => {
    const entry = historyEntry({ savedRequestId: 99 });

    expect(historyEntryCollectionId(entry, { 10: [savedRequest(7)] })).toBeNull();
  });
});
