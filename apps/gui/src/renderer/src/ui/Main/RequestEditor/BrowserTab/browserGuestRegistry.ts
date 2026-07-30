/**
 * Tracks browser tab ids that already have a main-process WebContentsView guest.
 */
const createdBrowserGuests = new Set<string>();

/**
 * Returns whether a browser guest has already been created for a tab.
 *
 * @param tabId - Browser tab id.
 * @returns True when create has been called for this tab.
 */
export function hasBrowserGuest(tabId: string): boolean {
  return createdBrowserGuests.has(tabId);
}

/**
 * Marks a browser guest as created after a successful browserCreate call.
 *
 * @param tabId - Browser tab id.
 */
export function markBrowserGuestCreated(tabId: string): void {
  createdBrowserGuests.add(tabId);
}

/**
 * Clears the created marker after the guest was destroyed (force or requestClose).
 *
 * Safe to call when main already tore down the guest; does not invoke IPC.
 *
 * @param tabId - Browser tab id.
 */
export function clearBrowserGuest(tabId: string): void {
  createdBrowserGuests.delete(tabId);
}

/**
 * Force-destroys main-process guests for browser tabs that are no longer open.
 *
 * Idempotent when {@link clearBrowserGuest} already ran after a successful
 * `browserRequestClose` (no registry entry → no IPC). `browserDestroy` itself is
 * also a no-op when the main-process session is already gone.
 *
 * @param openBrowserTabIds - Tab ids currently present in Redux.
 */
export function syncDestroyedBrowserGuests(openBrowserTabIds: ReadonlySet<string>): void {
  for (const tabId of [...createdBrowserGuests]) {
    if (openBrowserTabIds.has(tabId)) {
      continue;
    }
    void window.api.browserDestroy(tabId);
    createdBrowserGuests.delete(tabId);
  }
}

/**
 * Clears the in-memory guest registry (tests).
 */
export function resetBrowserGuestRegistryForTests(): void {
  createdBrowserGuests.clear();
}
