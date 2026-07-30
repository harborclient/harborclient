/**
 * Pointer movement (px) required before a timeline pan or scrub gesture
 * commits, so clicks still seek without accidental drags.
 */
export const WORKFLOW_TIMELINE_DRAG_THRESHOLD_PX = 4;

/**
 * Element surface needed to map pointer client X into track content coordinates.
 */
export type TimelineTrackHitTarget = Pick<Element, 'getBoundingClientRect'>;

/**
 * Converts a viewport client X coordinate into an X within the timeline track
 * content, clamped to the layout width.
 *
 * Uses the track element's bounding rect so scroll position is already accounted
 * for (the rect's left edge moves with horizontal scroll).
 *
 * @param clientX - Pointer `clientX` from the event.
 * @param trackElement - Track content element that owns playhead X coordinates.
 * @param totalWidthPx - Layout total width used to clamp the result.
 * @returns Content X in pixels from the start of the track.
 */
export function clientXToTimelineContentX(
  clientX: number,
  trackElement: TimelineTrackHitTarget,
  totalWidthPx: number
): number {
  const rect = trackElement.getBoundingClientRect();
  const x = clientX - rect.left;
  const max = Math.max(0, totalWidthPx);
  return Math.min(Math.max(x, 0), max);
}

/**
 * Computes the next horizontal scroll offset for a pan gesture.
 *
 * Dragging right reveals content to the left (decreases scrollLeft).
 *
 * @param startScrollLeft - Viewport scrollLeft at pointer down.
 * @param originClientX - Pointer clientX at pointer down.
 * @param clientX - Current pointer clientX.
 * @returns Non-negative scrollLeft to apply.
 */
export function timelinePanScrollLeft(
  startScrollLeft: number,
  originClientX: number,
  clientX: number
): number {
  return Math.max(0, startScrollLeft - (clientX - originClientX));
}

/**
 * Returns whether pointer movement from the drag origin exceeds the threshold.
 *
 * @param originClientX - Pointer clientX at pointer down.
 * @param clientX - Current pointer clientX.
 * @param thresholdPx - Movement threshold in pixels.
 * @returns True when the gesture should commit as a drag.
 */
export function timelinePointerExceededDragThreshold(
  originClientX: number,
  clientX: number,
  thresholdPx: number = WORKFLOW_TIMELINE_DRAG_THRESHOLD_PX
): boolean {
  return Math.abs(clientX - originClientX) >= thresholdPx;
}
