/** Selector matching visible, enabled focusable controls inside a tab panel. */
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** DOM id prefix for main editor tab panels. */
export const REQUEST_TAB_PANEL_ID_PREFIX = 'request-tabpanel-';

/**
 * Builds the DOM id for a main editor tab panel.
 *
 * @param tabId - Open tab id.
 * @returns Element id used by the request editor tab panel container.
 */
export function requestTabPanelElementId(tabId: string): string {
  return `${REQUEST_TAB_PANEL_ID_PREFIX}${tabId}`;
}

/**
 * Resolves the request editor tab label element id from a keyboard event target.
 *
 * @param target - Event target, usually {@link document.activeElement}.
 * @returns Tab id when focus is on or inside a main editor tab label, else null.
 */
export function resolveRequestTabIdFromFocusTarget(target: EventTarget | null): string | null {
  if (
    target == null ||
    typeof target !== 'object' ||
    !('closest' in target) ||
    typeof target.closest !== 'function'
  ) {
    return null;
  }

  const tabElement = target.closest('[role="tab"]');
  if (
    tabElement == null ||
    typeof tabElement !== 'object' ||
    !('id' in tabElement) ||
    typeof tabElement.id !== 'string' ||
    !tabElement.id.startsWith('request-tab-')
  ) {
    return null;
  }

  return tabElement.id.slice('request-tab-'.length);
}

/**
 * Returns visible focusable descendants of a tab panel in document order.
 *
 * @param panel - Tab panel root element.
 * @returns Focusable elements that are not hidden or inert in layout.
 */
function getVisibleFocusables(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.closest('[aria-hidden="true"]')) {
      return false;
    }

    if (element.offsetParent === null && getComputedStyle(element).position !== 'fixed') {
      return false;
    }

    return true;
  });
}

/**
 * Moves focus to the first visible focusable control inside a request tab panel.
 *
 * @param tabId - Open tab id whose linked panel should receive focus.
 * @returns True when focus moved into the panel.
 */
export function focusFirstFocusableInRequestTabPanel(tabId: string): boolean {
  const panel = document.getElementById(requestTabPanelElementId(tabId));
  if (panel == null) {
    return false;
  }

  const firstFocusable = getVisibleFocusables(panel)[0];
  if (firstFocusable == null || typeof firstFocusable.focus !== 'function') {
    return false;
  }

  firstFocusable.focus();
  return true;
}
