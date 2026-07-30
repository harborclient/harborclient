import type { MenuActionId } from '@harborclient/core/types/app';
import type { RootState } from '#/renderer/src/store/redux';
import { selectActiveTab } from '#/renderer/src/store/selectors';
import { isBrowserTab } from '#/renderer/src/store/tabs';
import { focusBrowserAddress } from './focusBrowserAddress';

/**
 * Live Page navigation menu actions that require an active browser tab.
 */
export type BrowserNavMenuAction = Extract<
  MenuActionId,
  'browser-reload' | 'browser-go-back' | 'browser-go-forward' | 'focus-browser-address'
>;

/**
 * Runs a Live Page navigation menu action when the active tab is a browser tab.
 *
 * Reload / back / forward call the existing browser IPC APIs. Focus address
 * moves shell focus to the chrome address bar. No-ops for non-browser tabs.
 *
 * @param action - Browser navigation menu action id.
 * @param getState - Redux getState used to read the active tab.
 */
export function runBrowserNavMenuAction(
  action: BrowserNavMenuAction,
  getState: () => RootState
): void {
  if (action === 'focus-browser-address') {
    focusBrowserAddress(getState);
    return;
  }

  const tab = selectActiveTab(getState());
  if (tab == null || !isBrowserTab(tab)) {
    return;
  }

  if (action === 'browser-reload') {
    void window.api.browserReload(tab.tabId);
    return;
  }

  if (action === 'browser-go-back') {
    void window.api.browserGoBack(tab.tabId);
    return;
  }

  void window.api.browserGoForward(tab.tabId);
}
