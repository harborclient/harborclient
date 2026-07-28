import type { SidebarExpansionState } from '@harborclient/core/types';

/** Prefetched sidebar expansion snapshot from shell bootstrap, if any. */
let prefetched: SidebarExpansionState | null = null;

/**
 * Stashes a sidebar expansion snapshot fetched during shell bootstrap so the
 * expansion hook can apply it synchronously without a second IPC round-trip.
 *
 * @param snapshot - Expansion state returned by `getSidebarExpansion`.
 */
export function setPrefetchedSidebarExpansion(snapshot: SidebarExpansionState): void {
  prefetched = snapshot;
}

/**
 * Returns and clears the prefetched sidebar expansion snapshot.
 *
 * @returns Prefetched snapshot, or null when bootstrap did not stash one.
 */
export function consumePrefetchedSidebarExpansion(): SidebarExpansionState | null {
  const snapshot = prefetched;
  prefetched = null;
  return snapshot;
}

/**
 * Peeks at the prefetched snapshot without consuming it (for tests).
 *
 * @returns Current prefetch, or null.
 */
export function peekPrefetchedSidebarExpansionForTests(): SidebarExpansionState | null {
  return prefetched;
}

/**
 * Clears prefetch state for tests simulating a cold app start.
 */
export function resetSidebarExpansionPrefetchForTests(): void {
  prefetched = null;
}
