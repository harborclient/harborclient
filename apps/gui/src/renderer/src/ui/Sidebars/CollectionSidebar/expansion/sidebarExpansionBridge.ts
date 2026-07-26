import type { SidebarExpansionState } from '@harborclient/core/types';

/**
 * Applies a collections sidebar expansion snapshot into the live React state.
 */
export type SidebarExpansionApplier = (state: SidebarExpansionState) => void;

/**
 * Active applier registered by {@link usePersistedSidebarExpansion} so workspace
 * restore can push layout without living inside the expansion provider tree.
 */
let sidebarExpansionApplier: SidebarExpansionApplier | null = null;

/**
 * Registers the active sidebar expansion applier.
 *
 * @param applier - Applies a full expansion snapshot, or null to unregister.
 * @returns Cleanup that unregisters when the provider unmounts.
 */
export function registerSidebarExpansionApplier(
  applier: SidebarExpansionApplier | null
): () => void {
  sidebarExpansionApplier = applier;
  return () => {
    if (sidebarExpansionApplier === applier) {
      sidebarExpansionApplier = null;
    }
  };
}

/**
 * Applies a sidebar expansion snapshot when an applier is registered.
 *
 * @param state - Expansion snapshot from a workspace layout.
 */
export function applyRegisteredSidebarExpansion(state: SidebarExpansionState): void {
  sidebarExpansionApplier?.(state);
}
