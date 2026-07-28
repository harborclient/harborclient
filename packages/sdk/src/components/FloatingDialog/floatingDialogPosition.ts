/**
 * Minimum gap between a floating dialog and the viewport edge.
 */
export const FLOATING_DIALOG_VIEWPORT_MARGIN_PX = 8;

/**
 * Default corner left offset used when a dialog must be relocated on-screen.
 */
export const FLOATING_DIALOG_DEFAULT_LEFT = 96;

/**
 * Default corner top offset used when a dialog must be relocated on-screen.
 */
export const FLOATING_DIALOG_DEFAULT_TOP = 96;

/**
 * Top-left coordinates for a fixed floating dialog.
 */
export interface FloatingDialogPosition {
  /**
   * CSS `left` in viewport pixels.
   */
  left: number;

  /**
   * CSS `top` in viewport pixels.
   */
  top: number;
}

/**
 * Measured floating dialog dimensions.
 */
export interface FloatingDialogSize {
  /**
   * Panel width in pixels.
   */
  width: number;

  /**
   * Panel height in pixels.
   */
  height: number;
}

/**
 * Returns whether a floating dialog at `position` with `size` fits fully inside
 * the viewport, respecting the viewport margin.
 *
 * @param position - Proposed top-left coordinates.
 * @param size - Measured panel width and height.
 * @param viewport - Optional viewport size (defaults to `window` when available).
 * @returns True when the panel is fully visible inside the margin.
 */
export function isFloatingDialogFullyOnScreen(
  position: FloatingDialogPosition,
  size: FloatingDialogSize,
  viewport?: { width: number; height: number }
): boolean {
  const margin = FLOATING_DIALOG_VIEWPORT_MARGIN_PX;
  const viewportWidth = viewport?.width ?? (typeof window !== 'undefined' ? window.innerWidth : 0);
  const viewportHeight =
    viewport?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 0);

  if (size.width <= 0 || size.height <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return true;
  }

  return (
    position.left >= margin &&
    position.top >= margin &&
    position.left + size.width <= viewportWidth - margin &&
    position.top + size.height <= viewportHeight - margin
  );
}
