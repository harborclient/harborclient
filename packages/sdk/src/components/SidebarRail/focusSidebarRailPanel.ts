import { getFocusableElements } from '../useDialogFocus.js';

/**
 * Builds the stable DOM id for a sidebar rail tab button.
 *
 * Used for `id` on the tab and `aria-labelledby` on the associated tabpanel.
 *
 * @param itemId - Rail item id from {@link SidebarRailItemData.id}.
 * @returns Stable element id string.
 */
export function sidebarRailTabId(itemId: string): string {
  return `hc-sidebar-rail-tab-${itemId}`;
}

/**
 * Moves focus to the first visible focusable element inside a rail tab panel.
 *
 * Falls back to focusing the panel itself (making it programmatically focusable)
 * when the panel has no interactive descendants yet — for example empty states
 * or content still mounting after a mode change.
 *
 * @param panel - Tab panel element, or null when missing from the DOM.
 * @returns True when focus moved into the panel or onto a descendant.
 */
export function focusSidebarRailPanel(panel: HTMLElement | null): boolean {
  if (panel == null) {
    return false;
  }

  let firstFocusable: HTMLElement | undefined = getFocusableElements(panel)[0];

  if (firstFocusable == null) {
    const selector =
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    firstFocusable =
      Array.from(panel.querySelectorAll<HTMLElement>(selector)).find(
        (element) => !element.closest('[aria-hidden="true"]')
      ) ?? undefined;
  }

  if (firstFocusable != null && typeof firstFocusable.focus === 'function') {
    firstFocusable.focus();
    return true;
  }

  if (typeof panel.focus !== 'function') {
    return false;
  }

  if (!panel.hasAttribute('tabindex')) {
    panel.tabIndex = -1;
  }

  panel.focus();
  return document.activeElement === panel;
}

/**
 * Returns focus from a rail tab panel to the tab that labels it.
 *
 * Skips CodeMirror editors so Arrow keys keep editing text. Used when the
 * directional key opposite the panel-entry key is pressed inside the panel.
 *
 * @param panel - Tab panel that currently contains focus.
 * @returns True when focus moved back to the owning tab.
 */
export function focusSidebarRailTabFromPanel(panel: HTMLElement): boolean {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !panel.contains(active)) {
    return false;
  }

  if (active.closest('.cm-editor') != null) {
    return false;
  }

  const labelledBy = panel.getAttribute('aria-labelledby');
  if (labelledBy == null || labelledBy === '') {
    return false;
  }

  const tab = document.getElementById(labelledBy);
  if (!(tab instanceof HTMLElement) || typeof tab.focus !== 'function') {
    return false;
  }

  tab.focus();
  return document.activeElement === tab;
}
