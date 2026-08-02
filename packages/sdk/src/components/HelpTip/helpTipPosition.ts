import {
  MENU_VIEWPORT_MARGIN_PX,
  type MenuPosition,
  type MenuSize,
  clampMenuPosition
} from '../menuPosition.js';

/** Gap between the trigger icon and the tip panel. */
export const HELP_TIP_TRIGGER_GAP_PX = 4;

/**
 * Computes tip coordinates anchored to the trigger, preferring above the icon
 * and falling back below when there is not enough room.
 *
 * @param triggerRect - Trigger bounding rect in viewport coordinates.
 * @param size - Measured or estimated tip dimensions.
 * @returns Viewport top-left for the tip panel, clamped to the viewport.
 */
export function getHelpTipPosition(triggerRect: DOMRect, size: MenuSize): MenuPosition {
  const spaceAbove = triggerRect.top - MENU_VIEWPORT_MARGIN_PX - HELP_TIP_TRIGGER_GAP_PX;
  const placeAbove = spaceAbove >= size.height;
  const x = triggerRect.left;
  const y = placeAbove
    ? triggerRect.top - HELP_TIP_TRIGGER_GAP_PX - size.height
    : triggerRect.bottom + HELP_TIP_TRIGGER_GAP_PX;
  return clampMenuPosition({ x, y }, size);
}
