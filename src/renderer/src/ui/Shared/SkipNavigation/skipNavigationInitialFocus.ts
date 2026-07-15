import { SKIP_NAVIGATION_ID } from '#/renderer/src/ui/Shared/SkipNavigation/skipNavigationTargets';

/**
 * Returns true when a blocking modal should keep launch focus out of skip navigation.
 *
 * @returns Whether an open dialog is currently trapping focus.
 */
export function hasBlockingModalForSkipNavigation(): boolean {
  return document.querySelector('[role="dialog"][aria-modal="true"]') != null;
}

/**
 * Focuses a neutral launch anchor once on startup, retrying until it mounts or a
 * blocking modal appears. The anchor sits outside the skip menu so the menu stays
 * hidden until the user presses Tab.
 *
 * @param launchAnchor - Off-screen sentinel that receives initial focus.
 * @param isApplied - Whether launch focus has already been applied.
 * @returns Whether launch focus was applied, should retry, or should stop.
 */
export function focusSkipNavigationOnLaunch(
  launchAnchor: HTMLElement | null,
  isApplied: boolean
): 'applied' | 'retry' | 'stop' {
  if (isApplied) {
    return 'stop';
  }

  if (hasBlockingModalForSkipNavigation()) {
    return 'retry';
  }

  if (launchAnchor == null) {
    return 'retry';
  }

  launchAnchor.focus({ preventScroll: true });
  return 'applied';
}

/**
 * Focuses a skip-navigation target landmark without scrolling the layout.
 *
 * @param targetId - DOM id of the landmark section to activate.
 * @returns True when focus landed on the target element.
 */
export function focusSkipTarget(targetId: string): boolean {
  const target = document.getElementById(targetId);
  if (target == null || typeof target.focus !== 'function') {
    return false;
  }

  target.focus({ preventScroll: true });
  return document.activeElement === target;
}

/**
 * Reveals skip navigation by focusing its first link or button.
 *
 * Used by the editable "Focus main nav" keyboard shortcut so users can jump back
 * to the skip menu from anywhere in the shell.
 *
 * @returns True when focus landed inside the skip navigation menu.
 */
export function focusSkipNavigation(): boolean {
  const nav = document.getElementById(SKIP_NAVIGATION_ID);
  if (nav == null) {
    return false;
  }

  const firstFocusable = nav.querySelector<HTMLElement>('a[href], button:not([disabled])');
  if (firstFocusable != null && typeof firstFocusable.focus === 'function') {
    firstFocusable.focus({ preventScroll: true });
    return document.activeElement === firstFocusable;
  }

  if (typeof nav.focus !== 'function') {
    return false;
  }

  nav.focus({ preventScroll: true });
  return document.activeElement === nav;
}
