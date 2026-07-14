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
