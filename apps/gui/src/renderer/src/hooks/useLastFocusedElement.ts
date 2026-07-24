import { useEffect, useRef, type RefObject } from 'react';

/**
 * Focus options supported by Chromium for suppressing keyboard focus rings.
 */
type FocusWithoutRingOptions = FocusOptions & {
  focusVisible?: boolean;
};

/**
 * Returns true when the element is a meaningful focus target worth restoring.
 *
 * @param target - Candidate focus event target.
 * @returns Whether the target should be tracked as last focused.
 */
function isTrackableFocusTarget(target: EventTarget | null): target is HTMLElement {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target !== document.body && target !== document.documentElement;
}

/**
 * Tracks the most recently focused in-app element so menu accelerators can restore
 * focus without showing a keyboard focus ring.
 *
 * @returns Ref holding the last focused HTMLElement, if any.
 */
export function useLastFocusedElement(): RefObject<HTMLElement | null> {
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  /**
   * Records each focus move inside the renderer document.
   */
  useEffect(() => {
    const handleFocusIn = (event: FocusEvent): void => {
      if (!isTrackableFocusTarget(event.target)) {
        return;
      }

      lastFocusedRef.current = event.target;
    };

    document.addEventListener('focusin', handleFocusIn);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, []);

  return lastFocusedRef;
}

/**
 * Restores the previously focused element without triggering `:focus-visible` styling.
 *
 * @param lastFocusedRef - Ref populated by {@link useLastFocusedElement}.
 */
export function restoreLastFocusWithoutRing(lastFocusedRef: RefObject<HTMLElement | null>): void {
  const element = lastFocusedRef.current;
  if (element == null || !element.isConnected) {
    return;
  }

  const focus = element.focus as (options?: FocusWithoutRingOptions) => void;
  focus({ focusVisible: false });
}
