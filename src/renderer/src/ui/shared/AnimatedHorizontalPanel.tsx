import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type ReactNode,
  type RefObject,
  type TransitionEvent as ReactTransitionEvent
} from 'react';

interface Props {
  /**
   * Whether the panel should be visible (expanded).
   */
  open: boolean;

  /**
   * Panel content (aside, resize handle, etc.).
   */
  children: ReactNode;

  /**
   * Optional class names merged onto the animated outer shell.
   */
  className?: string;
}

interface AnimatedPanelState {
  /**
   * Whether the panel remains in the DOM (including during close animation).
   */
  mounted: boolean;

  /**
   * Whether the panel width target is expanded (drives CSS width transition).
   */
  expanded: boolean;

  /**
   * Measured natural width of inner content in pixels.
   */
  contentWidth: number;

  /**
   * Whether width transitions are enabled (disabled on first paint and reduced motion).
   */
  transitionEnabled: boolean;

  /**
   * Ref attached to the inner content wrapper for width measurement.
   */
  innerRef: RefObject<HTMLDivElement | null>;

  /**
   * Unmounts the panel after the close width transition completes.
   */
  handleTransitionEnd: (event: ReactTransitionEvent<HTMLDivElement>) => void;
}

/**
 * Returns whether the user prefers reduced motion.
 *
 * @returns True when the OS requests minimized animation.
 */
function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Manages mount/expand state for a horizontal panel with width animation.
 *
 * @param open - Target visibility from Redux or parent state.
 * @returns State and handlers for the animated shell.
 */
function useAnimatedHorizontalPanel(open: boolean): AnimatedPanelState {
  const innerRef = useRef<HTMLDivElement>(null);
  const initialMountRef = useRef(true);
  const [mounted, setMounted] = useState(open);
  const [expanded, setExpanded] = useState(open);
  const [contentWidth, setContentWidth] = useState(0);
  const [transitionEnabled, setTransitionEnabled] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);

  /**
   * Subscribes to OS reduced-motion preference changes.
   */
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    /**
     * Updates reduced-motion state when the OS preference changes.
     */
    const handleChange = (): void => {
      setReducedMotion(mediaQuery.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  /**
   * Tracks inner content width so the outer shell can animate to the current resizable size.
   */
  useLayoutEffect(() => {
    if (!mounted || !innerRef.current) {
      return;
    }

    const element = innerRef.current;

    /**
     * Writes the latest content width from a resize observation.
     *
     * @param width - Measured inner width in pixels.
     */
    const applyWidth = (width: number): void => {
      if (width > 0) {
        setContentWidth(width);
      }
    };

    const observer = new ResizeObserver(([entry]) => {
      applyWidth(entry.contentRect.width);
    });

    observer.observe(element);
    applyWidth(element.getBoundingClientRect().width);

    return () => observer.disconnect();
  }, [mounted]);

  /**
   * Syncs mount/expand state with `open`, respecting reduced motion and skipping animation on first paint.
   */
  useEffect(() => {
    let cancelled = false;

    /**
     * Applies visibility transitions after the current commit so eslint's
     * set-state-in-effect rule is satisfied and layout can settle first.
     */
    const syncVisibility = (): void => {
      if (cancelled) {
        return;
      }

      if (reducedMotion) {
        setMounted(open);
        setExpanded(open);
        setTransitionEnabled(false);
        initialMountRef.current = false;
        return;
      }

      if (initialMountRef.current) {
        initialMountRef.current = false;
        setMounted(open);
        setExpanded(open);
        requestAnimationFrame(() => {
          if (!cancelled) {
            setTransitionEnabled(true);
          }
        });
        return;
      }

      if (open) {
        setMounted(true);
        setExpanded(false);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!cancelled) {
              setExpanded(true);
            }
          });
        });
        return;
      }

      setExpanded(false);
    };

    queueMicrotask(syncVisibility);

    return () => {
      cancelled = true;
    };
  }, [open, reducedMotion]);

  /**
   * Unmounts the panel after the close width transition completes.
   */
  const handleTransitionEnd = useCallback(
    (event: ReactTransitionEvent<HTMLDivElement>): void => {
      if (event.propertyName !== 'width') {
        return;
      }

      if (!expanded && !open) {
        setMounted(false);
      }
    },
    [expanded, open]
  );

  return {
    mounted,
    expanded,
    contentWidth,
    transitionEnabled,
    innerRef,
    handleTransitionEnd
  };
}

/**
 * Horizontally collapsible panel shell with fast width animation for sidebars.
 *
 * Keeps children mounted during close so width can animate to zero before unmount.
 */
export function AnimatedHorizontalPanel({ open, children, className }: Props): JSX.Element | null {
  const { mounted, expanded, contentWidth, transitionEnabled, innerRef, handleTransitionEnd } =
    useAnimatedHorizontalPanel(open);

  if (!mounted) {
    return null;
  }

  const outerClassName = [
    'flex shrink-0 overflow-hidden',
    transitionEnabled
      ? 'transition-[width] duration-200 ease-out motion-reduce:transition-none'
      : 'transition-none',
    !open && 'pointer-events-none',
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={outerClassName}
      style={{ width: expanded ? contentWidth : 0 }}
      onTransitionEnd={handleTransitionEnd}
      aria-hidden={!open}
      inert={!open ? true : undefined}
    >
      <div ref={innerRef} className="flex shrink-0">
        {children}
      </div>
    </div>
  );
}
