import { useCallback, useEffect, useLayoutEffect, useRef, useState } from '@harborclient/sdk/react';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';
import { RESIZABLE_SYNC_EVENT } from './applyResizableSizes.js';

export { applyResizableSizes, RESIZABLE_SYNC_EVENT } from './applyResizableSizes.js';

type Axis = 'x' | 'y';

/** Id of the shared stylesheet injected during resize drags. */
const RESIZING_STYLE_ID = 'hc-resizable-drag-styles';

/**
 * Fraction of the remaining target gap closed per animation frame during drag.
 * Lower values feel heavier; higher values track the pointer more closely.
 */
const RESIZE_DRAG_LERP = 0.22;

/**
 * Stop the drag lerp loop when within this many pixels of the pointer target.
 */
const RESIZE_DRAG_SNAP_EPSILON = 0.5;

/**
 * Injects shared CSS that neutralizes webviews/iframes and shows the resize cursor during drags.
 * Electron webviews paint above normal DOM, so pointer-events must be disabled on the webview itself.
 */
function ensureResizingStylesheet(): void {
  if (document.getElementById(RESIZING_STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = RESIZING_STYLE_ID;
  style.textContent = `
    body[data-hc-resizing] webview,
    body[data-hc-resizing] iframe {
      pointer-events: none !important;
    }
    body[data-hc-resizing="y"] * {
      cursor: row-resize !important;
    }
    body[data-hc-resizing="x"] * {
      cursor: col-resize !important;
    }
    body[data-hc-resizing] {
      user-select: none !important;
    }
  `.trim();
  document.head.appendChild(style);
}

/**
 * Marks the document as in an active resize drag so embedded webviews pass pointer events through.
 *
 * @param axis - Resize axis used for cursor styling.
 */
function setResizingState(axis: Axis): void {
  ensureResizingStylesheet();
  document.body.dataset.hcResizing = axis;
}

/**
 * Clears the active resize drag marker from the document body.
 */
function clearResizingState(): void {
  delete document.body.dataset.hcResizing;
}

/**
 * Returns whether the user prefers reduced motion.
 *
 * @returns True when the OS requests minimized animation.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export interface UseResizableOptions {
  /**
   * Pointer axis used to compute drag delta.
   */
  axis: Axis;

  /**
   * Sign applied to pointer delta along the axis.
   */
  direction: 1 | -1;

  /**
   * Initial size when nothing is persisted.
   */
  defaultSize: number;

  /**
   * Minimum allowed size in pixels.
   */
  minSize: number;

  /**
   * Optional dynamic maximum size in pixels.
   */
  getMaxSize?: () => number;

  /**
   * When set, size is restored from and persisted to localStorage.
   */
  storageKey?: string;

  /**
   * Called when a resize is committed (mouseup after drag or keyboard nudge).
   */
  onPersist?: (size: number) => void;
}

export interface UseResizableResult {
  size: number;
  minSize: number;
  maxSize: number;
  setSize: (size: number) => void;
  onResizeStart: (event: ReactMouseEvent) => void;
  onKeyboardResize: (event: ReactKeyboardEvent) => void;
}

/**
 * Loads a persisted size from localStorage.
 *
 * @param storageKey - localStorage key for the panel size.
 * @param defaultSize - Fallback when the key is unset or invalid.
 */
function loadStoredSize(storageKey: string, defaultSize: number): number {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaultSize;
    const size = Number(raw);
    return Number.isFinite(size) ? size : defaultSize;
  } catch {
    return defaultSize;
  }
}

/**
 * Persists a size to localStorage.
 *
 * @param storageKey - localStorage key for the panel size.
 * @param size - Size in pixels to store.
 */
function persistSize(storageKey: string, size: number): void {
  try {
    localStorage.setItem(storageKey, String(size));
  } catch {
    // Ignore quota or privacy-mode failures.
  }
}

/**
 * Clamps a size between min and optional max bounds.
 *
 * @param size - Candidate size in pixels.
 * @param minSize - Minimum allowed size.
 * @param getMaxSize - Optional dynamic max getter.
 * @returns Size clamped to [minSize, max].
 */
function clampSize(size: number, minSize: number, getMaxSize?: () => number): number {
  const rawMax = getMaxSize?.() ?? Number.POSITIVE_INFINITY;
  const maxSize = Math.max(minSize, rawMax);
  return Math.min(maxSize, Math.max(minSize, size));
}

/**
 * Persists a committed resize size via localStorage and/or a caller callback.
 *
 * @param storageKey - Optional localStorage key.
 * @param onPersist - Optional commit callback.
 * @param size - Committed size in pixels.
 */
function commitSize(
  storageKey: string | undefined,
  onPersist: ((size: number) => void) | undefined,
  size: number
): void {
  if (storageKey) {
    persistSize(storageKey, size);
  }
  onPersist?.(size);
}

/**
 * Tracks resizable panel size with pointer drag and optional persistence.
 *
 * During drag, pointer movement sets a target size; the displayed size eases
 * toward that target each frame unless the user prefers reduced motion.
 */
export function useResizable({
  axis,
  direction,
  defaultSize,
  minSize,
  getMaxSize,
  storageKey,
  onPersist
}: UseResizableOptions): UseResizableResult {
  const [size, setSizeState] = useState(() => {
    const initial = storageKey ? loadStoredSize(storageKey, defaultSize) : defaultSize;
    return clampSize(initial, minSize, getMaxSize);
  });
  const [maxSize, setMaxSizeState] = useState(() => getMaxSize?.() ?? Number.POSITIVE_INFINITY);
  const resizingRef = useRef(false);
  const startPosRef = useRef(0);
  const startSizeRef = useRef(defaultSize);
  const sizeRef = useRef(size);
  const targetSizeRef = useRef(size);
  const rafIdRef = useRef<number | null>(null);
  const minSizeRef = useRef(minSize);
  const getMaxSizeRef = useRef(getMaxSize);

  /**
   * Keeps a ref in sync with state so drag handlers read the latest size.
   */
  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  /**
   * Keeps bound refs current so the lerp loop does not close over stale values.
   */
  useEffect(() => {
    minSizeRef.current = minSize;
    getMaxSizeRef.current = getMaxSize;
  }, [getMaxSize, minSize]);

  /**
   * Cancels any in-flight drag lerp animation frame.
   */
  const stopResizeLerp = useCallback((): void => {
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  /**
   * Eases displayed size toward the pointer target while a drag is active.
   */
  const runResizeLerpStep = useCallback((): void => {
    rafIdRef.current = null;
    if (!resizingRef.current) {
      return;
    }

    const current = sizeRef.current;
    const target = targetSizeRef.current;
    const gap = target - current;

    if (Math.abs(gap) <= RESIZE_DRAG_SNAP_EPSILON) {
      setSizeState(target);
      return;
    }

    const nextSize = clampSize(
      current + gap * RESIZE_DRAG_LERP,
      minSizeRef.current,
      getMaxSizeRef.current
    );
    setSizeState(nextSize);
    rafIdRef.current = requestAnimationFrame(runResizeLerpStep);
  }, []);

  /**
   * Starts the drag lerp loop when it is not already scheduled.
   */
  const startResizeLerp = useCallback((): void => {
    if (rafIdRef.current != null) {
      return;
    }
    rafIdRef.current = requestAnimationFrame(runResizeLerpStep);
  }, [runResizeLerpStep]);

  /**
   * Re-reads this panel's localStorage size when a workspace (or other caller)
   * applies sizes externally via {@link applyResizableSizes}.
   */
  useEffect(() => {
    if (!storageKey) {
      return;
    }

    /**
     * Loads the stored size for this panel and clamps it to current bounds.
     */
    const handleSync = (): void => {
      const nextSize = clampSize(loadStoredSize(storageKey, defaultSize), minSize, getMaxSize);
      setSizeState(nextSize);
    };

    window.addEventListener(RESIZABLE_SYNC_EVENT, handleSync);
    return () => {
      window.removeEventListener(RESIZABLE_SYNC_EVENT, handleSync);
    };
  }, [defaultSize, getMaxSize, minSize, storageKey]);

  /**
   * Refreshes the computed max size when layout changes or the panel is resized.
   */
  useLayoutEffect(() => {
    /**
     * Re-reads dynamic max bounds from the optional getter.
     */
    const updateMaxSize = (): void => {
      setMaxSizeState(getMaxSize?.() ?? Number.POSITIVE_INFINITY);
    };

    updateMaxSize();
    window.addEventListener('resize', updateMaxSize);
    return () => window.removeEventListener('resize', updateMaxSize);
  }, [getMaxSize, size]);

  /**
   * Updates panel size with min/max clamping applied.
   *
   * @param nextSize - Desired size in pixels before clamping.
   */
  const setSize = useCallback(
    (nextSize: number): void => {
      setSizeState(clampSize(nextSize, minSize, getMaxSize));
    },
    [getMaxSize, minSize]
  );

  /**
   * Captures pointer position and current size when a resize drag begins.
   *
   * @param event - React mouse event from the resize handle.
   */
  const onResizeStart = useCallback(
    (event: ReactMouseEvent): void => {
      event.preventDefault();
      stopResizeLerp();
      resizingRef.current = true;
      startPosRef.current = axis === 'x' ? event.clientX : event.clientY;
      startSizeRef.current = sizeRef.current;
      targetSizeRef.current = sizeRef.current;
      setResizingState(axis);
    },
    [axis, stopResizeLerp]
  );

  /**
   * Nudges panel size from arrow keys using the same axis/direction math as drag.
   *
   * @param event - React keyboard event from the focused resize handle.
   */
  const onKeyboardResize = useCallback(
    (event: ReactKeyboardEvent): void => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        return;
      }

      const step = event.shiftKey ? 1 : 10;
      let keyDelta = 0;

      if (axis === 'x') {
        if (event.key === 'ArrowRight') keyDelta = step;
        else if (event.key === 'ArrowLeft') keyDelta = -step;
      } else if (event.key === 'ArrowDown') {
        keyDelta = step;
      } else if (event.key === 'ArrowUp') {
        keyDelta = -step;
      }

      if (keyDelta === 0) return;

      event.preventDefault();
      const nextSize = clampSize(sizeRef.current + keyDelta * direction, minSize, getMaxSize);
      setSizeState(nextSize);
      commitSize(storageKey, onPersist, nextSize);
    },
    [axis, direction, getMaxSize, minSize, onPersist, storageKey]
  );

  /**
   * Applies pointer delta to panel size during drag and persists on mouse up.
   */
  useEffect(() => {
    /**
     * Updates the pointer target (and eases toward it) while a resize drag is active.
     *
     * @param event - Window mousemove event.
     */
    const handleMouseMove = (event: MouseEvent): void => {
      if (!resizingRef.current) return;
      const currentPos = axis === 'x' ? event.clientX : event.clientY;
      const delta = (currentPos - startPosRef.current) * direction;
      const nextSize = clampSize(startSizeRef.current + delta, minSize, getMaxSize);
      targetSizeRef.current = nextSize;

      if (prefersReducedMotion()) {
        setSizeState(nextSize);
        return;
      }

      startResizeLerp();
    };

    /**
     * Ends the resize drag, snaps to the pointer target, and commits the size.
     */
    const handleMouseUp = (): void => {
      if (!resizingRef.current) return;
      resizingRef.current = false;
      stopResizeLerp();
      clearResizingState();
      const snapped = clampSize(targetSizeRef.current, minSize, getMaxSize);
      setSizeState(snapped);
      commitSize(storageKey, onPersist, snapped);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      // Only detach listeners here. This effect re-runs whenever a dependency
      // such as `getMaxSize` changes identity (callers often pass an inline
      // function), which happens on every render the drag itself triggers via
      // setSizeState. Resetting `resizingRef`/clearing state here would abort
      // the drag after the first pointer move. Mid-drag teardown on real
      // unmount is handled by the dedicated unmount effect below.
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    axis,
    direction,
    getMaxSize,
    minSize,
    onPersist,
    startResizeLerp,
    stopResizeLerp,
    storageKey
  ]);

  /**
   * Clears the document resize marker and any lerp loop when the hook unmounts mid-drag.
   */
  useEffect(() => {
    return () => {
      stopResizeLerp();
      if (resizingRef.current) {
        resizingRef.current = false;
        clearResizingState();
      }
    };
  }, [stopResizeLerp]);

  return { size, minSize, maxSize, setSize, onResizeStart, onKeyboardResize };
}
