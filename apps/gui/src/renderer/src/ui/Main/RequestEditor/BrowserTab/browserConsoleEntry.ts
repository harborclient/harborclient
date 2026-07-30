import type { BrowserConsoleEntryPayload } from '@harborclient/core/types';
import type { ConsoleEntry } from '#/renderer/src/store/slices/consoleSlice';
import type { BrowserTab } from '#/renderer/src/store/tabs';

/**
 * Resolves the display name shown in the footer console for a live-page navigation.
 *
 * Prefers the tab bar title, then the page title from the snapshot, then the URL.
 *
 * @param tab - Browser tab that owns the guest, when still open.
 * @param payload - Console payload from main after did-finish-load.
 * @returns Non-empty request name for {@link ConsoleEntry}.
 */
export function resolveBrowserConsoleRequestName(
  tab: BrowserTab | undefined,
  payload: BrowserConsoleEntryPayload
): string {
  const fromTab = tab?.title?.trim();
  if (fromTab) {
    return fromTab;
  }
  const fromStatus = payload.result.statusText?.trim();
  if (fromStatus && fromStatus !== 'OK') {
    return fromStatus;
  }
  const fromUrl = payload.result.request?.url?.trim();
  if (fromUrl) {
    return fromUrl;
  }
  return 'Live page';
}

/**
 * Builds a Redux console entry from a live-page navigation payload.
 *
 * @param payload - IPC payload from `browser:console-entry`.
 * @param tab - Matching browser tab when still open (for name / tab id).
 * @returns ConsoleEntry ready for {@link addConsoleEntry}.
 */
export function consoleEntryFromBrowserPayload(
  payload: BrowserConsoleEntryPayload,
  tab: BrowserTab | undefined
): ConsoleEntry {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    requestName: resolveBrowserConsoleRequestName(tab, payload),
    requestTabId: payload.tabId,
    result: payload.result,
    logs: payload.logs,
    tests: payload.tests,
    executionEvents: payload.executionEvents,
    scriptError: payload.scriptError,
    scriptErrors: payload.scriptErrors
  };
}
