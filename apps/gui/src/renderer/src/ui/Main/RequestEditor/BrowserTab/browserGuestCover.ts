/**
 * Frozen viewport cover for the native WebContentsView guest.
 *
 * HTML overlays (Linux app menus, etc.) cannot paint above WebContentsView.
 * Callers capture the current viewport into a data URL, hide the guest, and
 * show the freeze frame in the React placeholder so the page does not flash
 * to the empty grey host.
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

let activeCover: BrowserGuestCover | null = null;
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
 * Safe to call when a cover is already active for the same tab (no-op). When the
 * tab id differs, replaces the previous cover and restores the prior guest first.
 * Capture failures still hide the guest (empty cover) so HTML overlays remain usable.
 *
 * @param tabId - Browser tab id that currently owns a visible guest.
 */
export async function coverBrowserGuestForOverlay(tabId: string): Promise<void> {
  if (activeCover?.tabId === tabId) {
    // Something else may have re-shown the guest (HMR / ensureGuest); force hide again.
    await window.api.browserSetVisible(tabId, false);
    return;
  }
  if (activeCover && activeCover.tabId !== tabId) {
    await uncoverBrowserGuest();
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
 * Clears the freeze frame and restores visibility for the covered guest.
 */
export async function uncoverBrowserGuest(): Promise<void> {
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
  notifyCoverListeners();
}

/**
 * Clears cover state without restoring visibility (tests / tab teardown).
 */
export function resetBrowserGuestCoverForTests(): void {
  activeCover = null;
  listeners.clear();
}
