import {
  useCallback,
  useEffect,
  useRef,
  useState,
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
  setSize: (size: number) => void;
  onResizeStart: (event: ReactMouseEvent) => void;
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
  const maxSize = getMaxSize?.() ?? Number.POSITIVE_INFINITY;
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
  const resizingRef = useRef(false);
  const startPosRef = useRef(0);
  const startSizeRef = useRef(defaultSize);
  const sizeRef = useRef(size);

  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  const setSize = useCallback(
    (nextSize: number): void => {
      setSizeState(clampSize(nextSize, minSize, getMaxSize));
    },
    [getMaxSize, minSize]
  );

  const onResizeStart = useCallback(
    (event: ReactMouseEvent): void => {
      event.preventDefault();
      resizingRef.current = true;
      startPosRef.current = axis === 'x' ? event.clientX : event.clientY;
      startSizeRef.current = sizeRef.current;
    },
    [axis]
  );

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent): void => {
      if (!resizingRef.current) return;
      const currentPos = axis === 'x' ? event.clientX : event.clientY;
      const delta = (currentPos - startPosRef.current) * direction;
      const nextSize = clampSize(startSizeRef.current + delta, minSize, getMaxSize);
      setSizeState(nextSize);
    };

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

  return { size, setSize, onResizeStart };
}
