import { useCallback, useEffect, useLayoutEffect, useRef, useState } from '@harborclient/sdk/react';
import type { JSX, PointerEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { cn } from '../utils.js';
import {
  FLOATING_DIALOG_DEFAULT_LEFT,
  FLOATING_DIALOG_DEFAULT_TOP,
  FLOATING_DIALOG_VIEWPORT_MARGIN_PX,
  type FloatingDialogPosition,
  type FloatingDialogSize,
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
   * Optional classes for the scrollable body region.
   */
  bodyClassName?: string;

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
   * When set with {@link initialHeight}, enables SE resize with explicit pixel size.
   */
  initialWidth?: number;

  /**
   * When set with {@link initialWidth}, enables SE resize with explicit pixel size.
   */
  initialHeight?: number;

  /**
   * Minimum panel width while resizing (defaults to 240).
   */
  minWidth?: number;

  /**
   * Minimum panel height while resizing (defaults to 120).
   */
  minHeight?: number;

  /**
   * Maximum panel width while resizing (defaults to viewport minus margins).
   */
  maxWidth?: number;

  /**
   * Maximum panel height while resizing (defaults to viewport minus margins).
   */
  maxHeight?: number;

  /**
   * Called when a resize gesture ends (or keyboard resize applies).
   *
   * @param size - Final width and height in viewport pixels.
   */
  onSizeChange?: (size: FloatingDialogSize) => void;

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
 * Clamps a proposed size into min/max and remaining viewport space.
 *
 * @param width - Proposed width.
 * @param height - Proposed height.
 * @param left - Current panel left.
 * @param top - Current panel top.
 * @param minWidth - Minimum width.
 * @param minHeight - Minimum height.
 * @param maxWidth - Optional max width cap.
 * @param maxHeight - Optional max height cap.
 * @returns Clamped size.
 */
function clampFloatingDialogSize(
  width: number,
  height: number,
  left: number,
  top: number,
  minWidth: number,
  minHeight: number,
  maxWidth?: number,
  maxHeight?: number
): FloatingDialogSize {
  const margin = FLOATING_DIALOG_VIEWPORT_MARGIN_PX;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : width;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : height;
  const roomWidth = Math.max(minWidth, viewportWidth - left - margin);
  const roomHeight = Math.max(minHeight, viewportHeight - top - margin);
  const widthCap = maxWidth != null ? Math.min(maxWidth, roomWidth) : roomWidth;
  const heightCap = maxHeight != null ? Math.min(maxHeight, roomHeight) : roomHeight;

  return {
    width: Math.min(Math.max(width, minWidth), widthCap),
    height: Math.min(Math.max(height, minHeight), heightCap)
  };
}

/**
 * Non-blocking, draggable dialog panel with no modal mask.
 *
 * Clicks pass through to the UI behind the panel. Drag by the handle region.
 * When `initialWidth` and `initialHeight` are provided, a southeast resize
 * handle appears (pointer + arrow-key accessible). Parents persist geometry via
 * `onPositionChange` / `onSizeChange`. If the panel would open or remain
 * off-screen after a window resize, it relocates to the default corner.
 *
 * Uses the elevated `bg-control` fill (not `bg-surface`) with a stronger border
 * and theme-aware shadow so the panel stays readable against the app chrome in
 * both light and dark themes.
 *
 * @param props - Dialog labelling, geometry, and content props.
 * @returns Floating dialog element.
 */
export function FloatingDialog({
  label,
  labelledBy,
  onClose,
  disableEscape = false,
  className,
  bodyClassName,
  initialLeft = FLOATING_DIALOG_DEFAULT_LEFT,
  initialTop = FLOATING_DIALOG_DEFAULT_TOP,
  onPositionChange,
  initialWidth,
  initialHeight,
  minWidth = 240,
  minHeight = 120,
  maxWidth,
  maxHeight,
  onSizeChange,
  dragHandle,
  children
}: Props): JSX.Element {
  const resizable = initialWidth != null && initialHeight != null;
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<FloatingDialogPosition>({
    left: initialLeft,
    top: initialTop
  });
  const [size, setSize] = useState<FloatingDialogSize | null>(() =>
    resizable
      ? clampFloatingDialogSize(
          initialWidth,
          initialHeight,
          initialLeft,
          initialTop,
          minWidth,
          minHeight,
          maxWidth,
          maxHeight
        )
      : null
  );
  const positionRef = useRef(position);
  const sizeRef = useRef(size);
  const onPositionChangeRef = useRef(onPositionChange);
  const onSizeChangeRef = useRef(onSizeChange);
  const dragStateRef = useRef<{
    pointerId: number;
    originX: number;
    originY: number;
    startLeft: number;
    startTop: number;
  } | null>(null);
  const resizeStateRef = useRef<{
    pointerId: number;
    originX: number;
    originY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  /**
   * Keeps the latest position available to resize handlers without rebinding.
   */
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  /**
   * Keeps the latest size available to relocate / resize handlers.
   */
  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  /**
   * Keeps the latest position-change callback available to layout/resize handlers.
   */
  useEffect(() => {
    onPositionChangeRef.current = onPositionChange;
  }, [onPositionChange]);

  /**
   * Keeps the latest size-change callback available to resize handlers.
   */
  useEffect(() => {
    onSizeChangeRef.current = onSizeChange;
  }, [onSizeChange]);

  /**
   * Moves the panel to the default corner when it would sit outside the viewport.
   */
  const relocateToCornerIfOffScreen = useCallback((): void => {
    const panel = panelRef.current;
    if (panel == null) {
      return;
    }

    const measured = sizeRef.current ?? {
      width: panel.offsetWidth,
      height: panel.offsetHeight
    };
    const current = positionRef.current;
    if (isFloatingDialogFullyOnScreen(current, measured)) {
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
    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
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

  /**
   * Begins a southeast resize from the resize handle.
   *
   * @param event - Pointer down on the resize handle.
   */
  const handleResizePointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>): void => {
      if (!resizable || size == null || event.button !== 0) {
        return;
      }
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      resizeStateRef.current = {
        pointerId: event.pointerId,
        originX: event.clientX,
        originY: event.clientY,
        startWidth: size.width,
        startHeight: size.height
      };
    },
    [resizable, size]
  );

  /**
   * Updates panel size while resizing from the SE handle.
   *
   * @param event - Pointer move on the resize handle.
   */
  const handleResizePointerMove = useCallback(
    (event: PointerEvent<HTMLButtonElement>): void => {
      const resize = resizeStateRef.current;
      if (resize == null || resize.pointerId !== event.pointerId) {
        return;
      }
      const next = clampFloatingDialogSize(
        resize.startWidth + (event.clientX - resize.originX),
        resize.startHeight + (event.clientY - resize.originY),
        positionRef.current.left,
        positionRef.current.top,
        minWidth,
        minHeight,
        maxWidth,
        maxHeight
      );
      sizeRef.current = next;
      setSize(next);
    },
    [maxHeight, maxWidth, minHeight, minWidth]
  );

  /**
   * Ends an active resize and notifies the parent of the final size.
   *
   * @param event - Pointer up/cancel on the resize handle.
   */
  const handleResizePointerUp = useCallback((event: PointerEvent<HTMLButtonElement>): void => {
    const resize = resizeStateRef.current;
    if (resize == null || resize.pointerId !== event.pointerId) {
      return;
    }
    resizeStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (sizeRef.current != null) {
      onSizeChangeRef.current?.(sizeRef.current);
    }
  }, []);

  /**
   * Adjusts size with arrow keys when the resize handle is focused.
   *
   * @param event - Keyboard event on the resize handle.
   */
  const handleResizeKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>): void => {
      if (size == null) {
        return;
      }
      const step = event.shiftKey ? 24 : 8;
      let deltaW = 0;
      let deltaH = 0;
      if (event.key === 'ArrowRight') {
        deltaW = step;
      } else if (event.key === 'ArrowLeft') {
        deltaW = -step;
      } else if (event.key === 'ArrowDown') {
        deltaH = step;
      } else if (event.key === 'ArrowUp') {
        deltaH = -step;
      } else {
        return;
      }
      event.preventDefault();
      const next = clampFloatingDialogSize(
        size.width + deltaW,
        size.height + deltaH,
        positionRef.current.left,
        positionRef.current.top,
        minWidth,
        minHeight,
        maxWidth,
        maxHeight
      );
      sizeRef.current = next;
      setSize(next);
      onSizeChangeRef.current?.(next);
    },
    [maxHeight, maxWidth, minHeight, minWidth, size]
  );

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      className={cn(
        'hc-floating-dialog fixed z-[60] flex min-w-[240px] flex-col overflow-hidden rounded-lg border border-text/15 bg-control shadow-[0_8px_28px_rgba(0,0,0,0.18)] dark:shadow-[0_12px_36px_rgba(0,0,0,0.55)]',
        className
      )}
      style={{
        left: position.left,
        top: position.top,
        ...(size != null ? { width: size.width, height: size.height } : {})
      }}
    >
      <div
        className="hc-floating-dialog-handle shrink-0 cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {dragHandle}
      </div>
      <div
        className={cn('hc-floating-dialog-body min-h-0 flex-1 overflow-auto p-3', bodyClassName)}
      >
        {children}
      </div>
      {resizable ? (
        <button
          type="button"
          aria-label="Resize dialog"
          className="absolute right-0 bottom-0 h-4 w-4 cursor-se-resize border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          onPointerCancel={handleResizePointerUp}
          onKeyDown={handleResizeKeyDown}
        >
          <span
            className="pointer-events-none absolute right-1 bottom-1 h-2 w-2 border-r-2 border-b-2 border-muted"
            aria-hidden
          />
        </button>
      ) : null}
    </div>
  );
}
