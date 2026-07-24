/**
 * Viewport coordinates for a fixed-position menu panel.
 */
export interface AiModelSelectMenuPosition {
  /**
   * Distance from the viewport left edge.
   */
  left: number;

  /**
   * Distance from the viewport top edge.
   */
  top: number;

  /**
   * Menu width matching the trigger when possible.
   */
  width: number;
}

/**
 * Bounding box used to place the model select menu relative to its trigger.
 */
export interface AiModelSelectAnchorRect {
  /**
   * Distance from the viewport left edge.
   */
  left: number;

  /**
   * Distance from the viewport top edge.
   */
  top: number;

  /**
   * Distance from the viewport bottom edge of the trigger.
   */
  bottom: number;

  /**
   * Trigger width in CSS pixels.
   */
  width: number;

  /**
   * Trigger height in CSS pixels.
   */
  height: number;
}

const VIEWPORT_MARGIN = 8;
const GAP = 4;

/**
 * Computes a fixed menu position that prefers opening below the trigger when
 * there is room, otherwise opens above, and clamps to the viewport.
 *
 * @param anchor - Trigger element bounding rect in viewport coordinates.
 * @param menuSize - Measured menu width and height.
 * @param viewport - Visible viewport size; defaults to the browser window.
 * @returns Clamped top-left coordinates and preferred menu width.
 */
export function computeAiModelSelectMenuPosition(
  anchor: AiModelSelectAnchorRect,
  menuSize: { width: number; height: number },
  viewport: { width: number; height: number } = {
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0
  }
): AiModelSelectMenuPosition {
  const width = Math.max(anchor.width, menuSize.width);
  const spaceBelow = viewport.height - anchor.bottom - VIEWPORT_MARGIN;
  const spaceAbove = anchor.top - VIEWPORT_MARGIN;
  const openAbove = spaceBelow < menuSize.height && spaceAbove > spaceBelow;

  let top = openAbove ? anchor.top - GAP - menuSize.height : anchor.bottom + GAP;

  const maxTop = Math.max(VIEWPORT_MARGIN, viewport.height - menuSize.height - VIEWPORT_MARGIN);
  top = Math.min(Math.max(top, VIEWPORT_MARGIN), maxTop);

  const maxLeft = Math.max(VIEWPORT_MARGIN, viewport.width - width - VIEWPORT_MARGIN);
  const left = Math.min(Math.max(anchor.left, VIEWPORT_MARGIN), maxLeft);

  return { left, top, width };
}
