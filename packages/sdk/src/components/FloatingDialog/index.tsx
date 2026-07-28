import { useCallback, useEffect, useLayoutEffect, useRef, useState } from '@harborclient/sdk/react';
import type { JSX, PointerEvent, ReactNode } from 'react';
import { cn } from '../utils.js';
import {
  FLOATING_DIALOG_DEFAULT_LEFT,
  FLOATING_DIALOG_DEFAULT_TOP,
  FLOATING_DIALOG_VIEWPORT_MARGIN_PX,
  type FloatingDialogPosition,
  isFloatingDialogFullyOnScreen
} from './floatingDialogPosition.js';

interface Props {
  /**
   * Accessible name for the dialog when no labelled heading id is provided.
   */
  label: string;

  /**
   * Optional id of a visible heading that labels the dialog.
   */
  labelledBy?: string;

  /**
   * Called when Escape is pressed (parent decides discard / close).
   */
  onClose: () => void;

  /**
   * When true, Escape does not call `onClose`.
   */
  disableEscape?: boolean;

  /**
   * Optional width/position classes for the floating panel.
   */
  className?: string;

  /**
   * Initial CSS `left` in pixels.
   */
  initialLeft?: number;

  /**
   * Initial CSS `top` in pixels.
   */
  initialTop?: number;

  /**
   * Called when the panel position changes after a drag ends or a corner reset.
   *
   * @param position - Final top-left coordinates in viewport pixels.
   */
  onPositionChange?: (position: FloatingDialogPosition) => void;

  /**
   * Header content used as the drag handle.
   */
  dragHandle: ReactNode;

  /**
   * Dialog body content.
   */
  children: ReactNode;
}

/**
 * Non-blocking, draggable dialog panel with no modal mask.
 *
 * Clicks pass through to the UI behind the panel. Drag by the handle region.
 * Remembers nothing itself — parents persist via `onPositionChange`. If the
 * panel would open or remain off-screen after a window resize, it relocates to
 * the default corner instead of sliding to the nearest edge.
 */
export function FloatingDialog({
  label,
  labelledBy,
  onClose,
  disableEscape = false,
  className,
  initialLeft = FLOATING_DIALOG_DEFAULT_LEFT,
  initialTop = FLOATING_DIALOG_DEFAULT_TOP,
  onPositionChange,
  dragHandle,
  children
}: Props): JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<FloatingDialogPosition>({
    left: initialLeft,
    top: initialTop
  });
  const positionRef = useRef(position);
  const onPositionChangeRef = useRef(onPositionChange);
  const dragStateRef = useRef<{
    pointerId: number;
    originX: number;
    originY: number;
    startLeft: number;
    startTop: number;
  } | null>(null);

  /**
   * Keeps the latest position available to resize handlers without rebinding.
   */
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  /**
   * Keeps the latest position-change callback available to layout/resize handlers.
   */
  useEffect(() => {
    onPositionChangeRef.current = onPositionChange;
  }, [onPositionChange]);

  /**
   * Moves the panel to the default corner when it would sit outside the viewport.
   */
  const relocateToCornerIfOffScreen = useCallback((): void => {
    const panel = panelRef.current;
    if (panel == null) {
      return;
    }

    const size = { width: panel.offsetWidth, height: panel.offsetHeight };
    const current = positionRef.current;
    if (isFloatingDialogFullyOnScreen(current, size)) {
      return;
    }

    const corner: FloatingDialogPosition = {
      left: FLOATING_DIALOG_DEFAULT_LEFT,
      top: FLOATING_DIALOG_DEFAULT_TOP
    };
    positionRef.current = corner;
    setPosition(corner);
    onPositionChangeRef.current?.(corner);
  }, []);

  /**
   * After first paint and whenever the window resizes, relocates only when off-screen.
   */
  useLayoutEffect(() => {
    relocateToCornerIfOffScreen();
    window.addEventListener('resize', relocateToCornerIfOffScreen);
    return () => window.removeEventListener('resize', relocateToCornerIfOffScreen);
  }, [relocateToCornerIfOffScreen]);

  /**
   * Closes the dialog when Escape is pressed unless disabled.
   */
  useEffect(() => {
    if (disableEscape) {
      return;
    }

    /**
     * Dismisses the floating dialog on Escape.
     *
     * @param event - Keyboard event.
     */
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [disableEscape, onClose]);

  /**
   * Begins a pointer drag from the header handle.
   *
   * @param event - Pointer down event on the drag handle.
   */
  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>): void => {
      if (event.button !== 0) {
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      dragStateRef.current = {
        pointerId: event.pointerId,
        originX: event.clientX,
        originY: event.clientY,
        startLeft: position.left,
        startTop: position.top
      };
    },
    [position.left, position.top]
  );

  /**
   * Updates panel position while dragging.
   *
   * @param event - Pointer move event.
   */
  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>): void => {
    const drag = dragStateRef.current;
    if (drag == null || drag.pointerId !== event.pointerId) {
      return;
    }
    const next: FloatingDialogPosition = {
      left: Math.max(
        FLOATING_DIALOG_VIEWPORT_MARGIN_PX,
        drag.startLeft + (event.clientX - drag.originX)
      ),
      top: Math.max(
        FLOATING_DIALOG_VIEWPORT_MARGIN_PX,
        drag.startTop + (event.clientY - drag.originY)
      )
    };
    positionRef.current = next;
    setPosition(next);
  }, []);

  /**
   * Ends an active pointer drag and notifies the parent of the final position.
   *
   * @param event - Pointer up/cancel event.
   */
  const handlePointerUp = useCallback((event: PointerEvent<HTMLDivElement>): void => {
    const drag = dragStateRef.current;
    if (drag == null || drag.pointerId !== event.pointerId) {
      return;
    }
    dragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onPositionChangeRef.current?.(positionRef.current);
  }, []);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      className={cn(
        'hc-floating-dialog fixed z-[60] flex min-w-[240px] flex-col overflow-hidden rounded-lg border border-separator bg-surface shadow-xl',
        className
      )}
      style={{ left: position.left, top: position.top }}
    >
      <div
        className="hc-floating-dialog-handle cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {dragHandle}
      </div>
      <div className="hc-floating-dialog-body p-3">{children}</div>
    </div>
  );
}
