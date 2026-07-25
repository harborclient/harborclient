/**
 * Interval between typewriter reveal ticks in milliseconds.
 */
export const TYPEWRITER_TICK_MS = 16;

/**
 * Computes how many characters to reveal on the next typewriter tick.
 *
 * Longer replies use a larger step so multi-kilobyte answers finish in a few seconds
 * while short replies still feel typed character-by-character.
 *
 * @param remainingLength - Characters still hidden.
 * @param totalLength - Full message length.
 * @returns Character count to reveal on this tick (at least 1 when remaining > 0).
 */
export function typewriterRevealStep(remainingLength: number, totalLength: number): number {
  if (remainingLength <= 0) {
    return 0;
  }

  let step = 1;
  if (totalLength > 4000) {
    step = 12;
  } else if (totalLength > 1500) {
    step = 6;
  } else if (totalLength > 400) {
    step = 3;
  } else if (totalLength > 80) {
    step = 2;
  }

  return Math.min(step, remainingLength);
}

/**
 * Advances the visible character count for a typewriter reveal.
 *
 * @param visibleLength - Characters currently shown.
 * @param totalLength - Full message length.
 * @returns Next visible length (never exceeds totalLength).
 */
export function advanceTypewriterReveal(visibleLength: number, totalLength: number): number {
  if (visibleLength >= totalLength) {
    return totalLength;
  }

  const remaining = totalLength - visibleLength;
  return visibleLength + typewriterRevealStep(remaining, totalLength);
}

/**
 * Returns whether the OS prefers reduced motion.
 *
 * @returns True when typewriter animation should be skipped.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
