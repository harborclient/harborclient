import type { JSX } from 'react';

/**
 * Vertical overhang of the playhead above and below the block row, in pixels.
 */
export const TIMELINE_PLAYHEAD_OVERHANG_PX = 15;

/**
 * Horizontal gutter so a centered playhead at x=0 (or the track end) is not clipped.
 */
export const TIMELINE_PLAYHEAD_EDGE_PAD_PX = 10;

interface Props {
  /**
   * Horizontal offset of the playhead within the track content, in pixels.
   */
  xPx: number;
}

/**
 * Vertical playhead marker: large downward caret at the top and a 3px theme-foreground line.
 *
 * Extends {@link TIMELINE_PLAYHEAD_OVERHANG_PX} above and below the block row. Uses `text`
 * (not accent) so the marker stays visible against selected block borders.
 *
 * @param props - Playhead X position.
 * @returns Absolutely positioned decorative playhead.
 */
export function TimelinePlayhead({ xPx }: Props): JSX.Element {
  const overhang = TIMELINE_PLAYHEAD_OVERHANG_PX;
  return (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2"
      style={{
        left: xPx,
        top: -overhang,
        height: `calc(100% + ${overhang * 2}px)`
      }}
      aria-hidden
    >
      <span
        className="absolute left-1/2 top-0 z-10 h-0 w-0 -translate-x-1/2 border-l-[9px] border-r-[9px] border-t-[12px] border-l-transparent border-r-transparent border-t-text"
        aria-hidden
      />
      <span
        className="absolute left-1/2 top-0 h-full w-[3px] -translate-x-1/2 bg-text"
        aria-hidden
      />
    </div>
  );
}
