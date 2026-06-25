import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent
} from 'react';

type Axis = 'x' | 'y';

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
 */
function clampSize(size: number, minSize: number, getMaxSize?: () => number): number {
  const rawMax = getMaxSize?.() ?? Number.POSITIVE_INFINITY;
  const maxSize = Math.max(minSize, rawMax);
  return Math.min(maxSize, Math.max(minSize, size));
}

/**
 * Tracks resizable panel size with pointer drag and optional persistence.
 */
export function useResizable({
  axis,
  direction,
  defaultSize,
  minSize,
  getMaxSize,
  storageKey
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

  /**
   * Keeps a ref in sync with state so drag handlers read the latest size.
   */
  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

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
   */
  const setSize = useCallback(
    (nextSize: number): void => {
      setSizeState(clampSize(nextSize, minSize, getMaxSize));
    },
    [getMaxSize, minSize]
  );

  /**
   * Captures pointer position and current size when a resize drag begins.
   */
  const onResizeStart = useCallback(
    (event: ReactMouseEvent): void => {
      event.preventDefault();
      resizingRef.current = true;
      startPosRef.current = axis === 'x' ? event.clientX : event.clientY;
      startSizeRef.current = sizeRef.current;
    },
    [axis]
  );

  /**
   * Nudges panel size from arrow keys using the same axis/direction math as drag.
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
      if (storageKey) {
        persistSize(storageKey, nextSize);
      }
    },
    [axis, direction, getMaxSize, minSize, storageKey]
  );

  /**
   * Applies pointer delta to panel size during drag and persists on mouse up.
   */
  useEffect(() => {
    /**
     * Updates size from pointer movement while a resize drag is active.
     *
     * @param event - Window mousemove event.
     */
    const handleMouseMove = (event: MouseEvent): void => {
      if (!resizingRef.current) return;
      const currentPos = axis === 'x' ? event.clientX : event.clientY;
      const delta = (currentPos - startPosRef.current) * direction;
      const nextSize = clampSize(startSizeRef.current + delta, minSize, getMaxSize);
      setSizeState(nextSize);
    };

    /**
     * Ends the resize drag and writes the final size to localStorage when configured.
     */
    const handleMouseUp = (): void => {
      if (!resizingRef.current) return;
      resizingRef.current = false;
      if (storageKey) {
        persistSize(storageKey, sizeRef.current);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [axis, direction, getMaxSize, minSize, storageKey]);

  return { size, minSize, maxSize, setSize, onResizeStart, onKeyboardResize };
}
