import { useEffect } from '@harborclient/sdk/react';
import type { RefObject } from 'react';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const inertLockCounts = new WeakMap<Element, number>();

/**
 * Increments or decrements an inert lock on an element so nested dialogs
 * do not prematurely restore interactivity on shared siblings.
 *
 * @param element - Element to lock or unlock.
 * @param locked - Whether to apply or release an inert lock.
 */
function setInertLocked(element: Element, locked: boolean): void {
  const count = inertLockCounts.get(element) ?? 0;

  if (locked) {
    inertLockCounts.set(element, count + 1);
    (element as HTMLElement).inert = true;
    return;
  }

  const next = count - 1;
  if (next <= 0) {
    inertLockCounts.delete(element);
    (element as HTMLElement).inert = false;
  } else {
    inertLockCounts.set(element, next);
  }
}

/**
 * Marks sibling elements of the overlay container as inert while the dialog is open.
 *
 * @param overlay - Modal overlay root element.
 * @returns Siblings that received an inert lock from this call.
 */
function lockOverlaySiblings(overlay: HTMLElement): Element[] {
  const parent = overlay.parentElement;
  if (!parent) return [];

  const locked: Element[] = [];
  for (const child of parent.children) {
    if (child === overlay) continue;
    setInertLocked(child, true);
    locked.push(child);
  }
  return locked;
}

/**
 * Releases inert locks previously applied to overlay siblings.
 *
 * @param siblings - Sibling elements to unlock.
 */
function unlockOverlaySiblings(siblings: Element[]): void {
  for (const sibling of siblings) {
    setInertLocked(sibling, false);
  }
}

/**
 * Returns whether a focusable element is visible enough to receive keyboard focus.
 *
 * @param element - Candidate focusable element.
 */
function isFocusableVisible(element: HTMLElement): boolean {
  if (element.closest('[aria-hidden="true"]')) {
    return false;
  }

  if (element.offsetParent !== null || getComputedStyle(element).position === 'fixed') {
    return true;
  }

  let parent = element.parentElement;
  while (parent) {
    if (getComputedStyle(parent).position === 'fixed') {
      return true;
    }
    parent = parent.parentElement;
  }

  return false;
}

/**
 * Returns visible, enabled focusable descendants of a container, excluding
 * elements inside `aria-hidden` subtrees.
 *
 * @param container - Dialog panel element to search within.
 * @returns Focusable elements in document order.
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const candidates = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

  return candidates.filter(isFocusableVisible);
}

/**
 * Traps keyboard focus within a dialog panel, inerts background siblings,
 * and restores focus on unmount.
 *
 * @param panelRef - Ref attached to the dialog overlay element.
 */
export function useDialogFocus(panelRef: RefObject<HTMLElement | null>): void {
  /**
   * Moves initial focus into the panel, traps Tab/Shift+Tab, inerts sibling
   * content, and restores focus to the element that opened the dialog when
   * the panel unmounts.
   */
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const inertedSiblings = lockOverlaySiblings(panel);
    const previousFocus = document.activeElement;

    if (!panel.contains(document.activeElement)) {
      const focusables = getFocusableElements(panel);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        panel.tabIndex = -1;
        panel.focus();
      }
    }

    /**
     * Wraps Tab and Shift+Tab at the edges of the panel focusables.
     *
     * @param event - Document keydown event.
     */
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Tab') return;

      const focusables = getFocusableElements(panel);
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !panel.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !panel.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      unlockOverlaySiblings(inertedSiblings);
      if (previousFocus instanceof HTMLElement && document.contains(previousFocus)) {
        previousFocus.focus();
      }
    };
  }, [panelRef]);
}
