import type { RootState } from '#/renderer/src/store/redux';
import { selectActiveTab } from '#/renderer/src/store/selectors';
import { isBrowserTab } from '#/renderer/src/store/tabs';

/**
 * Returns the stable DOM id for a Live Page address bar input.
 *
 * @param tabId - Browser tab id.
 * @returns Element id used by {@link BrowserChrome} and focus helpers.
 */
export function browserAddressInputId(tabId: string): string {
  return `browser-address-${tabId}`;
}

/**
 * Focuses the active Live Page address field and selects its full value.
 *
 * Moves keyboard focus from a guest WebContentsView back to the shell when
 * needed, then focuses the address input after two animation frames so React
 * can mount chrome for the active tab. No-ops when the active tab is not a
 * Live Page or the address input is not mounted.
 *
 * @param getState - Redux getState used to read the active tab.
 */
export function focusBrowserAddress(getState: () => RootState): void {
  const tab = selectActiveTab(getState());
  if (tab == null || !isBrowserTab(tab)) {
    return;
  }

  const inputId = browserAddressInputId(tab.tabId);

  /**
   * Waits for the shell to regain focus from a guest view, then focuses the
   * address input after React can mount chrome for the active tab.
   */
  void window.api.focusRenderer().then(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const input = document.getElementById(inputId);
        if (
          input == null ||
          !('select' in input) ||
          typeof input.focus !== 'function' ||
          typeof input.select !== 'function'
        ) {
          return;
        }

        input.focus();
        input.select();
      });
    });
  });
}
