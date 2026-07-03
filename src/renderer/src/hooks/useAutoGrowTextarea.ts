import { useLayoutEffect, type RefObject } from 'react';

/** Default starting height for the AI chat composer prompt field. */
export const COMPOSER_MIN_HEIGHT_PX = 72;

/** Maximum auto-grown height (~12 lines) before the composer scrolls internally. */
export const COMPOSER_MAX_HEIGHT_PX = 288;

interface AutoGrowOptions {
  /**
   * Minimum rendered height in pixels.
   */
  minHeight?: number;

  /**
   * Maximum auto-grown height in pixels before overflow scrolling begins.
   */
  maxHeight?: number;
}

interface AutoGrowHeightResult {
  /**
   * Clamped height to apply to the textarea element.
   */
  heightPx: number;

  /**
   * Whether content exceeds the maximum and needs vertical scrolling.
   */
  overflowY: 'auto' | 'hidden';
}

/**
 * Clamps a measured textarea scroll height between configured min and max bounds.
 *
 * @param scrollHeight - Native scrollHeight after resetting inline height for measurement.
 * @param minHeight - Minimum rendered height in pixels.
 * @param maxHeight - Maximum auto-grown height in pixels.
 * @returns Height and overflow mode to apply to the textarea.
 */
export function computeAutoGrowHeight(
  scrollHeight: number,
  minHeight: number,
  maxHeight: number
): AutoGrowHeightResult {
  const heightPx = Math.min(Math.max(scrollHeight, minHeight), maxHeight);

  return {
    heightPx,
    overflowY: scrollHeight > maxHeight ? 'auto' : 'hidden'
  };
}

/**
 * Resizes a textarea to fit its content up to a maximum height, then enables scrolling.
 *
 * @param textareaRef - Ref to the native textarea element.
 * @param value - Current draft text; height is recomputed whenever this changes.
 * @param options - Optional min/max height overrides.
 */
export function useAutoGrowTextarea(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  value: string,
  options: AutoGrowOptions = {}
): void {
  const minHeight = options.minHeight ?? COMPOSER_MIN_HEIGHT_PX;
  const maxHeight = options.maxHeight ?? COMPOSER_MAX_HEIGHT_PX;

  /**
   * Measures scroll height after clearing inline height so the field can shrink and grow
   * with the draft, including when it is cleared on send.
   */
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (textarea == null) {
      return;
    }

    textarea.style.height = '0px';
    const { heightPx, overflowY } = computeAutoGrowHeight(
      textarea.scrollHeight,
      minHeight,
      maxHeight
    );
    textarea.style.height = `${heightPx}px`;
    textarea.style.overflowY = overflowY;
  }, [maxHeight, minHeight, textareaRef, value]);
}
