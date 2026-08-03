import type { Collection } from '@harborclient/core/types';

/**
 * Returns a collection id that is safe as a blank-tab save/display target.
 *
 * Archived collections stay in Redux (for the Archive sidebar) but must not
 * be inherited by "+" / File → New → Request tabs via `selectedCollectionId`.
 *
 * @param collections - Full collections list from the store (active + archived).
 * @param candidateId - Candidate collection id from draft or sidebar selection.
 * @returns The candidate when it exists and is not archived; otherwise null.
 */
export function resolveActiveCollectionTargetId(
  collections: readonly Collection[],
  candidateId: number | null | undefined
): number | null {
  if (candidateId == null) {
    return null;
  }
  const collection = collections.find((entry) => entry.id === candidateId);
  if (collection == null || collection.archived) {
    return null;
  }
  return candidateId;
}
