import { isRequestTab } from '#/renderer/src/store/drafts';
import type { AppDispatch, RootState } from '#/renderer/src/store/redux';
import { setShowRequestEditor } from '#/renderer/src/store/slices/navigationSlice';
import { setActiveTab } from '#/renderer/src/store/slices/tabsSlice';

/** Maximum animation frames to retry focusing a tab control after React updates. */
const FOCUS_TAB_MAX_ATTEMPTS = 6;

/**
 * Builds the DOM id for a main editor tab control.
 *
 * @param tabId - Open tab id.
 * @returns Element id used by the request editor tab bar.
 */
export function requestTabElementId(tabId: string): string {
  return `request-tab-${tabId}`;
}

/**
 * Focuses a request editor tab control and scrolls it into view when possible.
 *
 * Uses plain {@link HTMLElement.focus} so Chromium applies `:focus:not(:focus-visible)`
 * styling for programmatic moves (shortcuts and arrow-key tab changes).
 *
 * @param tabId - Open tab id whose tab bar control should receive focus.
 * @returns True when focus landed on the tab element.
 */
export function focusRequestTabControl(tabId: string): boolean {
  const tab = document.getElementById(requestTabElementId(tabId));
  if (tab == null || typeof tab.focus !== 'function') {
    return false;
  }

  tab.focus();
  if ('scrollIntoView' in tab && typeof tab.scrollIntoView === 'function') {
    tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  return document.activeElement === tab;
}

/**
 * Retries focusing a tab control across animation frames until React commits.
 *
 * @param tabId - Open tab id whose tab bar control should receive focus.
 */
export function focusRequestTabControlWhenMounted(tabId: string): void {
  let attempts = 0;

  /**
   * Attempts to focus the tab control, scheduling another frame when needed.
   */
  const tryFocus = (): void => {
    if (focusRequestTabControl(tabId) || attempts >= FOCUS_TAB_MAX_ATTEMPTS) {
      return;
    }

    attempts += 1;
    requestAnimationFrame(tryFocus);
  };

  requestAnimationFrame(tryFocus);
}

/**
 * Activates and focuses the leftmost open request editor tab.
 *
 * Skips page tabs (settings, collection settings, etc.). Ensures the request
 * editor strip is visible before focusing. No-ops when no request tabs are open.
 *
 * @param dispatch - Redux dispatch for tab and navigation updates.
 * @param getState - Reads the ordered open tabs list.
 */
export function focusFirstRequestTab(dispatch: AppDispatch, getState: () => RootState): void {
  const firstRequestTab = getState().tabs.tabs.find(isRequestTab);
  if (firstRequestTab == null) {
    return;
  }

  dispatch(setShowRequestEditor(true));
  dispatch(setActiveTab(firstRequestTab.tabId));
  focusRequestTabControlWhenMounted(firstRequestTab.tabId);
}
