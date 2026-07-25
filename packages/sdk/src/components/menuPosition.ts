/**
 * Viewport coordinates for a fixed-position menu panel.
 */
export interface MenuPosition {
  /** Left edge in viewport pixels. */
  x: number;

  /** Top edge in viewport pixels. */
  y: number;
}

/**
 * Measured menu panel dimensions.
 */
export interface MenuSize {
  /** Panel width in pixels. */
  width: number;

  /** Panel height in pixels. */
  height: number;
}

/** Minimum gap between a menu panel and the viewport edge. */
export const MENU_VIEWPORT_MARGIN_PX = 8;

/** Gap between a trigger button and its dropdown panel. */
export const MENU_TRIGGER_OFFSET_PX = 2;

/** Default minimum menu width used before the panel is measured. */
export const MENU_MIN_WIDTH_PX = 200;

/**
 * Clamps a menu position so the panel stays fully inside the viewport.
 *
 * @param position - Requested top-left coordinates.
 * @param size - Measured menu width and height.
 */
export function clampMenuPosition(position: MenuPosition, size: MenuSize): MenuPosition {
  const margin = MENU_VIEWPORT_MARGIN_PX;
  const maxX = Math.max(margin, window.innerWidth - size.width - margin);
  const maxY = Math.max(margin, window.innerHeight - size.height - margin);
  return {
    x: Math.min(Math.max(position.x, margin), maxX),
    y: Math.min(Math.max(position.y, margin), maxY)
  };
}

/**
 * Computes menu coordinates anchored to a trigger button, right-aligned with the
 * trigger's trailing edge. Opens below by default or above when `placement` is
 * `up`.
 *
 * @param triggerRect - Trigger bounding rect in viewport coordinates.
 * @param menuSize - Measured or estimated menu dimensions.
 * @param placement - Whether the panel opens below or above the trigger.
 */
export function getTriggerAnchoredMenuPosition(
  triggerRect: DOMRect,
  menuSize: MenuSize,
  placement: 'down' | 'up' = 'down'
): MenuPosition {
  const x = triggerRect.right - menuSize.width;
  const y =
    placement === 'up'
      ? triggerRect.top - MENU_TRIGGER_OFFSET_PX - menuSize.height
      : triggerRect.bottom + MENU_TRIGGER_OFFSET_PX;
  return { x, y };
}

/**
 * Computes flyout coordinates anchored beside a parent menu row, preferring
 * the right side and flipping to the left when the right side would overflow
 * the viewport.
 *
 * @param anchorRect - Bounding rect of the parent row that owns the flyout.
 * @param menuSize - Measured or estimated flyout dimensions.
 */
export function getSubmenuAnchoredPosition(anchorRect: DOMRect, menuSize: MenuSize): MenuPosition {
  const fitsOnRight =
    anchorRect.right + MENU_TRIGGER_OFFSET_PX + menuSize.width + MENU_VIEWPORT_MARGIN_PX <=
    window.innerWidth;

  const x = fitsOnRight
    ? anchorRect.right + MENU_TRIGGER_OFFSET_PX
    : anchorRect.left - menuSize.width - MENU_TRIGGER_OFFSET_PX;

  return { x, y: anchorRect.top };
}
