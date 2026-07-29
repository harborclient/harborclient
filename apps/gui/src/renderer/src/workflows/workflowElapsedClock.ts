/**
 * Interval used for workflow elapsed UI updates when the user prefers reduced motion.
 */
export const WORKFLOW_ELAPSED_REDUCED_MOTION_INTERVAL_MS = 250;

/**
 * Options for {@link startWorkflowElapsedClock}.
 */
export interface StartWorkflowElapsedClockOptions {
  /**
   * When provided, `onTick` runs only while this returns true (e.g. actively
   * recording or playing). The clock itself keeps running so it resumes without
   * restarting.
   */
  shouldTick?: () => boolean;

  /**
   * Override for reduced-motion detection (tests). Defaults to the OS preference.
   */
  prefersReducedMotion?: () => boolean;
}

/**
 * Returns whether the OS requests minimized animation.
 *
 * @returns True when `prefers-reduced-motion: reduce` matches.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Starts a clock that drives live workflow elapsed UI updates.
 *
 * Uses `requestAnimationFrame` for smooth timeline motion when motion is allowed.
 * Falls back to a {@link WORKFLOW_ELAPSED_REDUCED_MOTION_INTERVAL_MS} interval when
 * reduced motion is preferred.
 *
 * @param onTick - Invoked each frame or interval tick (subject to `shouldTick`).
 * @param options - Optional tick gate and reduced-motion override.
 * @returns Function that stops the clock and cancels pending frames/intervals.
 */
export function startWorkflowElapsedClock(
  onTick: () => void,
  options: StartWorkflowElapsedClockOptions = {}
): () => void {
  const shouldTick = options.shouldTick ?? ((): boolean => true);
  const reducedMotion = (options.prefersReducedMotion ?? prefersReducedMotion)();

  /**
   * Invokes `onTick` only when the optional gate allows it.
   */
  const maybeTick = (): void => {
    if (shouldTick()) {
      onTick();
    }
  };

  if (reducedMotion) {
    const intervalId = window.setInterval(maybeTick, WORKFLOW_ELAPSED_REDUCED_MOTION_INTERVAL_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }

  let frameId = 0;
  let stopped = false;

  /**
   * Schedules the next animation frame and ticks when still active.
   */
  const loop = (): void => {
    if (stopped) {
      return;
    }
    maybeTick();
    if (stopped) {
      return;
    }
    frameId = window.requestAnimationFrame(loop);
  };

  frameId = window.requestAnimationFrame(loop);

  return () => {
    stopped = true;
    window.cancelAnimationFrame(frameId);
  };
}
