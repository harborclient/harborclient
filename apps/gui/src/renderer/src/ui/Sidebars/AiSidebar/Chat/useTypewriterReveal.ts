import { useEffect, useRef, useState } from 'react';
import {
  TYPEWRITER_TICK_MS,
  advanceTypewriterReveal,
  prefersReducedMotion
} from './typewriterReveal';

interface Options {
  /**
   * Full message text to reveal.
   */
  content: string;

  /**
   * Called once when the reveal finishes or is skipped.
   */
  onComplete?: () => void;

  /**
   * Called on each reveal tick so parents can keep the list scrolled.
   */
  onProgress?: () => void;
}

/**
 * Reveals message content with a display-only typewriter effect.
 *
 * Mount a fresh instance (via React `key`) for each message that should animate.
 * Honors `prefers-reduced-motion` by showing the full string immediately.
 *
 * @param options - Content and completion/progress callbacks.
 * @returns The currently visible prefix of `content`.
 */
export function useTypewriterReveal({ content, onComplete, onProgress }: Options): string {
  const reducedMotion = prefersReducedMotion();
  const [visibleLength, setVisibleLength] = useState(() =>
    reducedMotion || content.length === 0 ? content.length : 0
  );
  const onCompleteRef = useRef(onComplete);
  const onProgressRef = useRef(onProgress);
  const completedRef = useRef(false);
  const previousVisibleRef = useRef(visibleLength);

  /**
   * Keeps callback refs current without restarting the reveal interval.
   */
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onProgressRef.current = onProgress;
  }, [onComplete, onProgress]);

  /**
   * Skips animation immediately when reduced motion is preferred or content is empty.
   */
  useEffect(() => {
    if (!reducedMotion && content.length > 0) {
      return;
    }

    if (!completedRef.current) {
      completedRef.current = true;
      onCompleteRef.current?.();
    }
  }, [content.length, reducedMotion]);

  const needsTicks = !reducedMotion && visibleLength < content.length;

  /**
   * Advances the visible prefix on a short interval until the full text is shown.
   */
  useEffect(() => {
    if (!needsTicks) {
      return;
    }

    const timer = window.setInterval(() => {
      setVisibleLength((current) => advanceTypewriterReveal(current, content.length));
    }, TYPEWRITER_TICK_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [needsTicks, content.length]);

  /**
   * Notifies parents of progress and completion as the visible length changes.
   */
  useEffect(() => {
    if (visibleLength > previousVisibleRef.current) {
      onProgressRef.current?.();
    }
    previousVisibleRef.current = visibleLength;

    if (visibleLength >= content.length && !completedRef.current) {
      completedRef.current = true;
      onCompleteRef.current?.();
    }
  }, [content.length, visibleLength]);

  return content.slice(0, visibleLength);
}
