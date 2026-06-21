/**
 * Monotonic generation counters keyed by refresh resource so late async responses
 * cannot overwrite fresher cache entries.
 */
const generations = new Map<string, number>();

/**
 * Allocates the next generation for a refresh resource and returns its token.
 * Call immediately before awaiting the database round trip.
 *
 * @param key - Stable resource identifier (e.g. `collections`, `folders:42`).
 * @returns Generation token to compare after the async work completes.
 */
export function beginRefreshGeneration(key: string): number {
  const next = (generations.get(key) ?? 0) + 1;
  generations.set(key, next);
  return next;
}

/**
 * Returns whether a generation token is still the latest for its resource key.
 *
 * @param key - Same key passed to {@link beginRefreshGeneration}.
 * @param generation - Token captured at refresh start.
 * @returns True when no newer refresh has started for the key.
 */
export function isLatestRefreshGeneration(key: string, generation: number): boolean {
  return generations.get(key) === generation;
}

/**
 * Builds a stable refresh key for collection-scoped sidebar data.
 *
 * @param resource - Nested resource within a collection.
 * @param collectionId - Owning collection id.
 * @returns Key suitable for {@link beginRefreshGeneration}.
 */
export function collectionRefreshKey(
  resource: 'folders' | 'requests',
  collectionId: number
): string {
  return `${resource}:${collectionId}`;
}
