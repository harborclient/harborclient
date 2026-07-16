import type { RequestHistoryEntry } from '#/shared/types/requestHistory';
import type { SavedRequest } from '#/shared/types';

/**
 * Resolves the collection id associated with a history sidebar entry, when known.
 *
 * Run entries use `runCollectionId` directly. Request entries are resolved by
 * looking up `savedRequestId` in the in-memory `requestsByCollection` cache.
 * Draft or unscoped sends return null.
 *
 * @param entry - History row to resolve.
 * @param requestsByCollection - Cached saved requests keyed by collection id.
 * @returns Collection id, or null when the entry is not tied to a collection.
 */
export function historyEntryCollectionId(
  entry: RequestHistoryEntry,
  requestsByCollection: Record<number, SavedRequest[]>
): number | null {
  if (entry.kind === 'run') {
    return entry.runCollectionId ?? null;
  }

  const savedRequestId = entry.savedRequestId;
  if (savedRequestId == null) {
    return null;
  }

  for (const [collectionIdKey, requests] of Object.entries(requestsByCollection)) {
    if (requests.some((request) => request.id === savedRequestId)) {
      return Number(collectionIdKey);
    }
  }

  return null;
}
