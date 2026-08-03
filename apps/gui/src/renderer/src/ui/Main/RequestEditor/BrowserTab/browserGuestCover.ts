/**
 * Frozen viewport cover for the native WebContentsView guest.
 *
 * HTML overlays (Linux app menus, etc.) cannot paint above WebContentsView.
 * Callers capture the current viewport into a data URL, hide the guest, and
 * show the freeze frame in the React placeholder so the page does not flash
 * to the empty grey host.
 *
 * Cover holds are reference-counted by owner id so nested overlays (address
 * suggestions inside an open footer panel, menus over modals, etc.) cannot
 * restore the guest while another overlay still needs it hidden.
 */

export interface BrowserGuestCover {
  /**
   * Browser tab whose guest is covered.
   */
  tabId: string;

  /**
   * Viewport PNG data URL shown in the guest placeholder.
   */
  dataUrl: string;
}

/**
 * Stable ids for callers that hold a guest cover.
 */
export type BrowserGuestCoverOwner =
  | 'footer-modals'
  | 'address-suggestions'
  | 'downloads-menu'
  | 'linux-menu'
  | 'tab-context-menu'
  | 'screenshot-mode';

let activeCover: BrowserGuestCover | null = null;
/** Owners that currently require the guest to stay covered. */
const coverOwners = new Set<BrowserGuestCoverOwner>();
const listeners = new Set<() => void>();

/**
 * Notifies subscribers that the active guest cover changed.
 */
function notifyCoverListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Returns the current freeze-frame cover, if any.
 *
 * @returns Active cover or null when the live guest should paint.
 */
export function getBrowserGuestCover(): BrowserGuestCover | null {
  return activeCover;
}

/**
 * Subscribes to cover changes for the guest placeholder.
 *
 * @param listener - Called whenever the active cover is set or cleared.
 * @returns Unsubscribe function.
 */
export function subscribeBrowserGuestCover(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Captures the guest viewport, publishes a freeze frame, then hides the native view.
 *
 * Safe to call when a cover is already active for the same tab (adds the owner
 * hold and re-hides if needed). When the tab id differs, replaces the previous
 * cover and restores the prior guest first. Capture failures still hide the
 * guest (empty cover) so HTML overlays remain usable.
 *
 * @param tabId - Browser tab id that currently owns a visible guest.
 * @param ownerId - Caller that requires the cover; released via uncoverBrowserGuest.
 */
export async function coverBrowserGuestForOverlay(
  tabId: string,
  ownerId: BrowserGuestCoverOwner
): Promise<void> {
  coverOwners.add(ownerId);

  if (activeCover?.tabId === tabId) {
    // Something else may have re-shown the guest (HMR / ensureGuest); force hide again.
    await window.api.browserSetVisible(tabId, false);
    return;
  }
  if (activeCover && activeCover.tabId !== tabId) {
    // Drop all holds for the prior tab; a different tab is taking over.
    coverOwners.clear();
    coverOwners.add(ownerId);
    const previous = activeCover;
    activeCover = null;
    notifyCoverListeners();
    await window.api.browserSetVisible(previous.tabId, true);
  }

  let dataUrl = '';
  try {
    const captured = await window.api.browserCapturePage(tabId, { fullPage: false });
    dataUrl = captured.dataUrl;
  } catch {
    // Mid-navigation or destroyed guest: hide without a freeze frame.
  }
  activeCover = { tabId, dataUrl };
  notifyCoverListeners();
  await window.api.browserSetVisible(tabId, false);
}

/**
 * Releases one owner's cover hold and restores the guest when no holds remain.
 *
 * @param ownerId - Caller that previously covered via coverBrowserGuestForOverlay.
 */
export async function uncoverBrowserGuest(ownerId: BrowserGuestCoverOwner): Promise<void> {
  coverOwners.delete(ownerId);
  if (coverOwners.size > 0) {
    return;
  }

  const previous = activeCover;
  if (!previous) {
    return;
  }
  activeCover = null;
  notifyCoverListeners();
  await window.api.browserSetVisible(previous.tabId, true);
}

/**
 * Drops cover state for a tab without restoring visibility (tab unmount/teardown).
 *
 * @param tabId - Browser tab id that is leaving the screen.
 */
export function dismissBrowserGuestCover(tabId: string): void {
  if (activeCover?.tabId !== tabId) {
    return;
  }
  activeCover = null;
  coverOwners.clear();
  notifyCoverListeners();
}

/**
 * Clears cover state without restoring visibility (tests / tab teardown).
 */
export function resetBrowserGuestCoverForTests(): void {
  activeCover = null;
  coverOwners.clear();
  listeners.clear();
}
