import { useCallback, useEffect, useLayoutEffect, useRef, useState } from '@harborclient/sdk/react';
import type { JSX, ReactNode, TransitionEvent as ReactTransitionEvent, RefObject } from 'react';

interface Props {
  /**
   * Tab row content to measure and collapse horizontally.
   */
  children: ReactNode;

  /**
   * Called after the close width transition finishes.
   */
  onComplete: () => void;
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
 * Manages width collapse state for a single closing tab shell.
 *
 * @param onComplete - Invoked after the close animation finishes.
 * @returns State and handlers for the animated shell.
 */
function useClosingTabShell(onComplete: () => void): {
  collapsed: boolean;
  contentWidth: number;
  innerRef: RefObject<HTMLDivElement | null>;
  reducedMotion: boolean;
  transitionEnabled: boolean;
  handleTransitionEnd: (event: ReactTransitionEvent<HTMLDivElement>) => void;
} {
  const innerRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);
  const [collapsed, setCollapsed] = useState(false);
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
   * Measures the tab row so the outer shell can animate from its natural width to zero.
   */
  useLayoutEffect(() => {
    if (!innerRef.current) {
      return;
    }

    const element = innerRef.current;

    /**
     * Writes the latest measured width from layout or resize observation.
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
  }, []);

  /**
   * Starts the collapse animation after the first paint, or completes immediately
   * when reduced motion is enabled.
   */
  useEffect(() => {
    if (reducedMotion) {
      onComplete();
      return;
    }

    if (contentWidth <= 0) {
      return;
    }

    requestAnimationFrame(() => {
      setTransitionEnabled(true);
      requestAnimationFrame(() => {
        setCollapsed(true);
      });
    });
  }, [contentWidth, onComplete, reducedMotion]);

  /**
   * Finishes the exit animation once the width transition completes.
   */
  const handleTransitionEnd = useCallback(
    (event: ReactTransitionEvent<HTMLDivElement>): void => {
      if (event.propertyName !== 'width' || completedRef.current) {
        return;
      }

      completedRef.current = true;
      onComplete();
    },
    [onComplete]
  );

  return {
    collapsed,
    contentWidth,
    innerRef,
    reducedMotion,
    transitionEnabled,
    handleTransitionEnd
  };
}

/**
 * Horizontally collapses a tab row with a quick width and opacity "zap out".
 *
 * Keeps children mounted until the width transition reaches zero so siblings
 * do not reflow until the animation completes.
 */
export function ClosingTabShell({ children, onComplete }: Props): JSX.Element | null {
  const {
    collapsed,
    contentWidth,
    innerRef,
    reducedMotion,
    transitionEnabled,
    handleTransitionEnd
  } = useClosingTabShell(onComplete);

  if (reducedMotion) {
    return null;
  }

  const outerClassName = [
    'flex shrink-0 overflow-hidden',
    transitionEnabled
      ? 'transition-[width] duration-150 ease-in motion-reduce:transition-none'
      : 'transition-none'
  ].join(' ');

  const innerClassName = [
    'flex shrink-0',
    transitionEnabled
      ? 'transition-[opacity,transform] duration-150 ease-in origin-right motion-reduce:transition-none'
      : 'transition-none',
    collapsed ? 'scale-x-95 opacity-0' : 'scale-x-100 opacity-100'
  ].join(' ');

  return (
    <div
      className={outerClassName}
      style={{ width: collapsed ? 0 : contentWidth }}
      onTransitionEnd={handleTransitionEnd}
      aria-hidden
      inert
    >
      <div ref={innerRef} className={innerClassName}>
        {children}
      </div>
    </div>
  );
}
