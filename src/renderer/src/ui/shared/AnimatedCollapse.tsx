import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type JSX,
  type ReactNode,
  type TransitionEvent as ReactTransitionEvent
} from 'react';

interface Props {
  /**
   * Whether the collapsible body should be visible (expanded).
   */
  open: boolean;

  /**
   * Collapsible content.
   */
  children: ReactNode;

  /**
   * Optional class names merged onto the animated outer shell.
   */
  className?: string;
}

interface AnimatedCollapseState {
  /**
   * Whether the shell remains in the DOM (including during close animation).
   */
  mounted: boolean;

  /**
   * Whether the grid row is expanded (drives CSS grid-template-rows transition).
   */
  expanded: boolean;

  /**
   * Whether grid-row transitions are enabled (disabled on first paint and reduced motion).
   */
  transitionEnabled: boolean;

  /**
   * Unmounts the shell after the close grid-row transition completes.
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
 * Manages mount/expand state for a vertical collapse with grid-row animation.
 *
 * @param open - Target visibility from parent state.
 * @returns State and handlers for the animated shell.
 */
function useAnimatedCollapse(open: boolean): AnimatedCollapseState {
  const initialMountRef = useRef(true);
  const [mounted, setMounted] = useState(open);
  const [expanded, setExpanded] = useState(open);
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
   * Syncs mount/expand state with `open`, respecting reduced motion and skipping animation on first paint.
   */
  useEffect(() => {
    let cancelled = false;

    /**
     * Applies visibility transitions after the current commit so layout can settle first.
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
          if (!cancelled) {
            setTransitionEnabled(true);
            requestAnimationFrame(() => {
              if (!cancelled) {
                setExpanded(true);
              }
            });
          }
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
   * Unmounts the shell after the close grid-row transition completes.
   */
  const handleTransitionEnd = useCallback(
    (event: ReactTransitionEvent<HTMLDivElement>): void => {
      if (event.propertyName !== 'grid-template-rows') {
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
    transitionEnabled,
    handleTransitionEnd
  };
}

/**
 * Vertically collapsible shell with grid-row animation for sidebar trees.
 *
 * Uses `grid-template-rows: 0fr ↔ 1fr` so content height is not remeasured mid-transition.
 * Keeps children mounted during close so the row can animate shut before unmount.
 */
export function AnimatedCollapse({ open, children, className }: Props): JSX.Element | null {
  const { mounted, expanded, transitionEnabled, handleTransitionEnd } = useAnimatedCollapse(open);

  if (!mounted) {
    return null;
  }

  const outerClassName = [
    'grid overflow-hidden',
    expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
    transitionEnabled
      ? 'transition-[grid-template-rows] duration-200 ease-in-out motion-reduce:transition-none'
      : 'transition-none',
    !open && 'pointer-events-none',
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={outerClassName}
      onTransitionEnd={handleTransitionEnd}
      aria-hidden={!open}
      inert={!open ? true : undefined}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
