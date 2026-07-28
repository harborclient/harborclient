import type { JSX } from 'react';

interface Props {
  /**
   * Horizontal offset of the playhead within the track content, in pixels.
   */
  xPx: number;
}

/**
 * Vertical playhead marker: downward caret at the top and a 2px theme-foreground line.
 *
 * Uses `text` (not accent) so the marker stays visible against selected block borders.
 *
 * @param props - Playhead X position.
 * @returns Absolutely positioned decorative playhead.
 */
export function TimelinePlayhead({ xPx }: Props): JSX.Element {
  return (
    <div
      className="pointer-events-none absolute top-0 z-20 h-full -translate-x-1/2"
      style={{ left: xPx }}
      aria-hidden
    >
      <span
        className="absolute left-1/2 top-0 z-10 h-0 w-0 -translate-x-1/2 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent border-t-text"
        aria-hidden
      />
      <span
        className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-text"
        aria-hidden
      />
    </div>
  );
}
