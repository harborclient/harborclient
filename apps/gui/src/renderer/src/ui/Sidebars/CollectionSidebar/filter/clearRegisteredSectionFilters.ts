/**
 * Optional clear handler registered by {@link SidebarSectionFilterProvider} so
 * expansion toggles (eye menu and Appearance menu) can reset session filters
 * without living inside the filter provider tree.
 */
let clearSectionFiltersHandler: (() => void) | null = null;

/**
 * Registers the active section-filter clear implementation.
 *
 * @param handler - Clears every session filter, or null to unregister.
 * @returns Cleanup that unregisters when the provider unmounts.
 */
export function registerClearSectionFiltersHandler(handler: (() => void) | null): () => void {
  clearSectionFiltersHandler = handler;
  return () => {
    if (clearSectionFiltersHandler === handler) {
      clearSectionFiltersHandler = null;
    }
  };
}

/**
 * Clears every sidebar section filter when a handler is registered.
 */
export function clearRegisteredSectionFilters(): void {
  clearSectionFiltersHandler?.();
}
