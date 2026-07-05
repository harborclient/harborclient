/** Gap between the anchor and tooltip edge in pixels. */
export const TOOLTIP_ANCHOR_GAP_PX = 4;

/**
 * Vertical placement for a tooltip relative to its anchor.
 */
export type TooltipPlacement = 'above' | 'below';

/**
 * Visible top and bottom bounds used for tooltip placement decisions.
 */
export interface BoundsRect {
  /**
   * Top edge of the visible container in viewport coordinates.
   */
  top: number;

  /**
   * Bottom edge of the visible container in viewport coordinates.
   */
  bottom: number;
}

/**
 * Finds the nearest ancestor with scrollable overflow.
 *
 * @param element - Element whose ancestors are searched.
 * @returns Scrollable parent, or null when none is found.
 */
export function findScrollParent(element: HTMLElement): HTMLElement | null {
  let parent = element.parentElement;

  while (parent) {
    const { overflow, overflowY } = getComputedStyle(parent);
    if (/(auto|scroll|overlay)/.test(overflowY) || /(auto|scroll|overlay)/.test(overflow)) {
      return parent;
    }
    parent = parent.parentElement;
  }

  return null;
}

/**
 * Returns the visible bounds of the scroll container or viewport.
 *
 * @param scrollParent - Scrollable ancestor from {@link findScrollParent}, if any.
 * @returns Container bounds in viewport coordinates.
 */
export function getTooltipContainerBounds(scrollParent: HTMLElement | null): BoundsRect {
  if (!scrollParent) {
    return { top: 0, bottom: window.innerHeight };
  }

  const rect = scrollParent.getBoundingClientRect();
  return { top: rect.top, bottom: rect.bottom };
}

/**
 * Chooses above or below placement based on available space in the container.
 *
 * @param anchorRect - Anchor element bounds in viewport coordinates.
 * @param tooltipHeight - Measured tooltip height in pixels.
 * @param containerBounds - Visible container bounds in viewport coordinates.
 * @param gap - Space between anchor and tooltip.
 * @returns Preferred vertical placement.
 */
export function resolveTooltipPlacement(
  anchorRect: DOMRect,
  tooltipHeight: number,
  containerBounds: BoundsRect,
  gap = TOOLTIP_ANCHOR_GAP_PX
): TooltipPlacement {
  const spaceBelow = containerBounds.bottom - anchorRect.bottom - gap;
  const spaceAbove = anchorRect.top - containerBounds.top - gap;

  if (spaceBelow >= tooltipHeight || spaceBelow >= spaceAbove) {
    return 'below';
  }

  return 'above';
}

/**
 * Builds fixed-position coordinates for a tooltip beside its anchor.
 *
 * @param anchorRect - Anchor element bounds in viewport coordinates.
 * @param placement - Resolved vertical placement.
 * @param gap - Space between anchor and tooltip.
 * @returns Viewport coordinates for the tooltip origin.
 */
export function buildFixedTooltipPosition(
  anchorRect: DOMRect,
  placement: TooltipPlacement,
  gap = TOOLTIP_ANCHOR_GAP_PX
): { top: number; left: number } {
  return {
    left: anchorRect.left,
    top: placement === 'below' ? anchorRect.bottom + gap : anchorRect.top - gap
  };
}
