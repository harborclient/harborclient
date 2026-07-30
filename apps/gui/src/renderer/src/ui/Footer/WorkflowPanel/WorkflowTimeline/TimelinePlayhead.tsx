import type { JSX, KeyboardEvent, PointerEvent } from 'react';

/**
 * Vertical overhang of the playhead above and below the block row, in pixels.
 */
export const TIMELINE_PLAYHEAD_OVERHANG_PX = 49;

/**
 * Horizontal padding inside the timeline box (Tailwind `px-4`) so a centered
 * playhead at x=0 (or the track end) is not clipped.
 */
export const TIMELINE_PLAYHEAD_EDGE_PAD_PX = 16;

/**
 * Invisible hit-target width around the playhead line so it is easy to grab.
 */
const PLAYHEAD_HIT_WIDTH_PX = 16;

interface Props {
  /**
   * Horizontal offset of the playhead within the track content, in pixels.
   */
  xPx: number;

  /**
   * Current playback cursor index (slider value).
   */
  selectedIndex: number;

  /**
   * Total number of actions on the timeline.
   */
  actionCount: number;

  /**
   * When true, pointer and keyboard scrubbing are disabled.
   */
  playing: boolean;

  /**
   * Seeks to an action index (keyboard and scrub release paths).
   *
   * @param index - Target action index.
   */
  onSeek: (index: number) => void;

  /**
   * Begins a playhead scrub gesture.
   *
   * @param event - Pointer down on the playhead hit target.
   */
  onScrubPointerDown: (event: PointerEvent<HTMLDivElement>) => void;

  /**
   * Updates scrub position while dragging the playhead.
   *
   * @param event - Pointer move while scrubbing.
   */
  onScrubPointerMove: (event: PointerEvent<HTMLDivElement>) => void;

  /**
   * Ends a playhead scrub gesture.
   *
   * @param event - Pointer up/cancel on the playhead.
   */
  onScrubPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
}

/**
 * Clamps an index into the valid action range `[0, actionCount - 1]`.
 *
 * @param index - Candidate index.
 * @param actionCount - Total actions.
 * @returns Clamped index, or `0` when there are no actions.
 */
function clampActionIndex(index: number, actionCount: number): number {
  if (actionCount <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(actionCount - 1, index));
}

/**
 * Vertical playhead marker: large downward caret at the top and a 3px theme-foreground line.
 *
 * Extends {@link TIMELINE_PLAYHEAD_OVERHANG_PX} above and below the block row. Uses `text`
 * (not accent) so the marker stays visible against selected block borders. When idle, the
 * marker is an interactive slider that can be dragged or stepped with arrow keys.
 *
 * @param props - Playhead position, selection, and scrub handlers.
 * @returns Absolutely positioned interactive playhead.
 */
export function TimelinePlayhead({
  xPx,
  selectedIndex,
  actionCount,
  playing,
  onSeek,
  onScrubPointerDown,
  onScrubPointerMove,
  onScrubPointerUp
}: Props): JSX.Element {
  const overhang = TIMELINE_PLAYHEAD_OVERHANG_PX;
  const maxIndex = Math.max(0, actionCount - 1);
  const valueNow = clampActionIndex(selectedIndex, actionCount);
  const valueText =
    actionCount <= 0
      ? 'No actions'
      : `Step ${Math.min(selectedIndex + 1, actionCount)} of ${actionCount}`;

  /**
   * Steps the playhead with arrow / Home / End keys when focused.
   *
   * @param event - Keyboard event from the slider.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (playing || actionCount <= 0) {
      return;
    }
    let next: number | null = null;
    if (event.key === 'ArrowLeft') {
      next = clampActionIndex(valueNow - 1, actionCount);
    } else if (event.key === 'ArrowRight') {
      next = clampActionIndex(valueNow + 1, actionCount);
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = maxIndex;
    }
    if (next == null) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onSeek(next);
  };

  return (
    <div
      className={[
        'absolute z-20 -translate-x-1/2 touch-none',
        playing
          ? 'pointer-events-none'
          : 'cursor-col-resize focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent'
      ].join(' ')}
      style={{
        left: xPx,
        top: -overhang,
        width: PLAYHEAD_HIT_WIDTH_PX,
        height: `calc(100% + ${overhang * 2}px)`
      }}
      role="slider"
      aria-label="Playhead"
      aria-valuemin={0}
      aria-valuemax={maxIndex}
      aria-valuenow={valueNow}
      aria-valuetext={valueText}
      aria-disabled={playing || undefined}
      tabIndex={playing || actionCount <= 0 ? -1 : 0}
      onKeyDown={handleKeyDown}
      onPointerDown={onScrubPointerDown}
      onPointerMove={onScrubPointerMove}
      onPointerUp={onScrubPointerUp}
      onPointerCancel={onScrubPointerUp}
    >
      <span
        className="pointer-events-none absolute left-1/2 top-0 z-10 h-0 w-0 -translate-x-1/2 border-l-[9px] border-r-[9px] border-t-[12px] border-l-transparent border-r-transparent border-t-text"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute left-1/2 top-0 h-full w-[3px] -translate-x-1/2 bg-text"
        aria-hidden
      />
    </div>
  );
}
