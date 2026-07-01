import { useEffect, useRef } from 'react';

import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectHasBlockingModal } from '#/renderer/src/store/slices/modalsSlice';

/**
 * Returns whether a modal dialog is currently open in the document tree.
 *
 * @returns True when an element with `aria-modal="true"` is present.
 */
export function isDomModalOpen(): boolean {
  return typeof document !== 'undefined' && document.querySelector('[aria-modal="true"]') != null;
}

/**
 * Decides whether Escape should trigger overlay back navigation.
 *
 * @param enabled - Whether the caller wants Escape-to-back active.
 * @param hasBlockingModal - Redux modal state that should block navigation.
 * @returns True when Escape should invoke the back handler.
 */
export function shouldHandleEscapeBack(enabled: boolean, hasBlockingModal: boolean): boolean {
  return enabled && !hasBlockingModal && !isDomModalOpen();
}

/**
 * Handles one Escape keydown for overlay back navigation.
 *
 * @param event - Keydown event from the window listener.
 * @param enabled - Whether the caller wants Escape-to-back active.
 * @param hasBlockingModal - Redux modal state that should block navigation.
 * @param onBack - Back navigation handler.
 */
export function handleEscapeBackKeydown(
  event: KeyboardEvent,
  enabled: boolean,
  hasBlockingModal: boolean,
  onBack: () => void
): void {
  if (event.key !== 'Escape') {
    return;
  }

  if (!shouldHandleEscapeBack(enabled, hasBlockingModal)) {
    return;
  }

  onBack();
}

/**
 * Subscribes to Escape on the window bubble phase to navigate back from a top-level overlay.
 *
 * @param onBack - Called when Escape is pressed and no blocking modal is open.
 * @param enabled - When false, the listener is not registered.
 */
export function useEscapeBack(onBack: () => void, enabled: boolean): void {
  const hasBlockingModal = useAppSelector(selectHasBlockingModal);
  const onBackRef = useRef(onBack);

  /**
   * Keeps the latest back handler available without resubscribing on every render.
   */
  useEffect(() => {
    onBackRef.current = onBack;
  });

  /**
   * Listens for Escape on the bubble phase when overlay back navigation is enabled.
   */
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      handleEscapeBackKeydown(event, enabled, hasBlockingModal, () => {
        onBackRef.current();
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, hasBlockingModal]);
}

/**
 * Subscribes to Escape on the window capture phase for nested overlay navigation.
 *
 * Stops propagation so parent overlay handlers do not run on the same key press.
 *
 * @param onBack - Called when Escape is pressed while enabled.
 * @param enabled - When false, the listener is not registered.
 */
export function useEscapeBackCapture(onBack: () => void, enabled: boolean): void {
  const onBackRef = useRef(onBack);

  /**
   * Keeps the latest back handler available without resubscribing on every render.
   */
  useEffect(() => {
    onBackRef.current = onBack;
  });

  /**
   * Handles Escape before bubble-phase overlay listeners when nested navigation is active.
   */
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onBackRef.current();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled]);
}
