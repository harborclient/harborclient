const FOOTER_LEFT_BUTTON_SELECTOR = '.hc-footer-button';
const FOOTER_RIGHT_ICON_SELECTOR = '.hc-footer-icon';

/**
 * Returns enabled footer bar controls matching the given selector.
 *
 * @param container - Footer group element to search within.
 * @param selector - Footer control selector.
 * @returns Matching controls in document order.
 */
function getFooterBarControls(container: HTMLElement, selector: string): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter((element) => {
    if (element.closest('[aria-hidden="true"]')) {
      return false;
    }
    if (element.matches(':disabled')) {
      return false;
    }
    return true;
  });
}

/**
 * Returns true when `activeElement` is the container or a descendant of it.
 *
 * @param container - Footer control that may contain the active element.
 * @param activeElement - Currently focused element.
 */
function isWithinFooterControl(container: HTMLElement, activeElement: Element | null): boolean {
  if (activeElement == null) {
    return false;
  }
  if (activeElement === container) {
    return true;
  }
  return typeof container.contains === 'function' && container.contains(activeElement);
}

/**
 * Returns true when keyboard focus is on the last left footer panel toggle.
 *
 * @param activeElement - Currently focused element.
 * @param leftButtons - Left footer panel toggle buttons in tab order.
 */
function isFocusOnLastLeftButton(
  activeElement: Element | null,
  leftButtons: HTMLElement[]
): boolean {
  if (leftButtons.length === 0) {
    return false;
  }

  return isWithinFooterControl(leftButtons[leftButtons.length - 1], activeElement);
}

/**
 * Returns true when keyboard focus is on the first right footer layout icon.
 *
 * @param activeElement - Currently focused element.
 * @param rightIcons - Right footer layout icon buttons in tab order.
 */
function isFocusOnFirstRightIcon(
  activeElement: Element | null,
  rightIcons: HTMLElement[]
): boolean {
  if (rightIcons.length === 0) {
    return false;
  }

  return isWithinFooterControl(rightIcons[0], activeElement);
}

/**
 * Focuses a footer control, requesting a keyboard focus ring when the browser
 * supports the non-standard `focusVisible` option.
 *
 * Falls back to a plain `focus()` call if the option-based call throws or does
 * not move focus, so preventing the default Tab never leaves focus stranded.
 *
 * @param element - Footer button or icon to focus.
 */
function focusFooterControl(element: HTMLElement): void {
  try {
    const focusWithOptions = element.focus as (
      options?: FocusOptions & { focusVisible?: boolean }
    ) => void;
    focusWithOptions({ focusVisible: true });
  } catch {
    // `focusVisible` is non-standard; ignore and fall back to a plain focus.
  }

  if (document.activeElement !== element) {
    element.focus();
  }
}

/**
 * Resolves whether Tab should move between the left footer panel toggles and the
 * right layout icon controls instead of following the default document order.
 *
 * @param shiftKey - Whether Shift was held with Tab.
 * @param activeElement - Currently focused element.
 * @param leftButtons - Left footer panel toggle buttons in tab order.
 * @param rightIcons - Right footer layout icon buttons in tab order.
 * @returns The element that should receive focus, if any.
 */
export function resolveFooterBarTabHandoff(
  shiftKey: boolean,
  activeElement: Element | null,
  leftButtons: HTMLElement[],
  rightIcons: HTMLElement[]
): HTMLElement | null {
  if (leftButtons.length === 0 || rightIcons.length === 0) {
    return null;
  }

  const firstRight = rightIcons[0];
  const lastLeft = leftButtons[leftButtons.length - 1];

  if (!shiftKey && isFocusOnLastLeftButton(activeElement, leftButtons)) {
    return firstRight;
  }

  if (shiftKey && isFocusOnFirstRightIcon(activeElement, rightIcons)) {
    return lastLeft;
  }

  return null;
}

/**
 * Moves Tab focus from the last left footer panel toggle to the first right layout
 * icon, and Shift+Tab from the first right icon back to the last left toggle.
 *
 * @param event - Keyboard event from the footer bar.
 * @param leftGroup - Container holding panel toggle buttons.
 * @param rightGroup - Container holding layout icon toggle buttons.
 * @returns True when the event was handled and default Tab behavior was suppressed.
 */
export function handleFooterBarTabNavigation(
  event: KeyboardEvent,
  leftGroup: HTMLElement,
  rightGroup: HTMLElement
): boolean {
  if (event.key !== 'Tab') {
    return false;
  }

  const target = resolveFooterBarTabHandoff(
    event.shiftKey,
    document.activeElement,
    getFooterBarControls(leftGroup, FOOTER_LEFT_BUTTON_SELECTOR),
    getFooterBarControls(rightGroup, FOOTER_RIGHT_ICON_SELECTOR)
  );

  if (target == null) {
    return false;
  }

  event.preventDefault();
  focusFooterControl(target);
  return true;
}

/**
 * Queries left footer panel toggles for tests and diagnostics.
 *
 * @param container - Left footer group element.
 * @returns Footer panel toggle buttons in document order.
 */
export function getFooterLeftButtons(container: HTMLElement): HTMLElement[] {
  return getFooterBarControls(container, FOOTER_LEFT_BUTTON_SELECTOR);
}

/**
 * Queries right footer layout icons for tests and diagnostics.
 *
 * @param container - Right footer icon group element.
 * @returns Footer layout icon buttons in document order.
 */
export function getFooterRightIcons(container: HTMLElement): HTMLElement[] {
  return getFooterBarControls(container, FOOTER_RIGHT_ICON_SELECTOR);
}

/**
 * Returns true when keyboard focus is on the last left footer panel toggle.
 *
 * Exported for unit tests.
 *
 * @param activeElement - Currently focused element.
 * @param leftButtons - Left footer panel toggle buttons in tab order.
 */
export function isFooterFocusOnLastLeftButton(
  activeElement: Element | null,
  leftButtons: HTMLElement[]
): boolean {
  return isFocusOnLastLeftButton(activeElement, leftButtons);
}
