import type { JSX } from 'react';
import { buildTimelineRulerTicks } from '#/renderer/src/workflows/timeline/workflowTimelineLayout';

interface Props {
  /**
   * Full recorded duration in milliseconds.
   */
  totalDurationMs: number;

  /**
   * Full track content width in pixels.
   */
  totalWidthPx: number;
}

/**
 * Time ruler drawn above the workflow timeline track.
 *
 * Edge ticks align to the start/end of the track so labels do not overflow
 * horizontally; middle ticks stay centered on their marks.
 *
 * @param props - Duration and width used to place tick labels.
 * @returns Ruler row with labelled ticks.
 */
export function TimelineRuler({ totalDurationMs, totalWidthPx }: Props): JSX.Element {
  /**
   * Derives tick marks for the current track width and duration.
   */
  const ticks = buildTimelineRulerTicks(totalDurationMs, totalWidthPx);

  return (
    <div
      className="relative h-6 shrink-0 overflow-hidden border-b border-separator"
      style={{ width: totalWidthPx }}
      aria-hidden
    >
      {ticks.map((tick, index) => {
        const isFirst = index === 0 || tick.xPx <= 0;
        const isLast = index === ticks.length - 1 || tick.xPx >= totalWidthPx;
        if (isFirst && !isLast) {
          return (
            <span
              key={`${tick.ms}-${tick.xPx}`}
              className="absolute top-0 left-0 text-[14px] tabular-nums text-muted"
            >
              {tick.label}
            </span>
          );
        }
        if (isLast && !isFirst) {
          return (
            <span
              key={`${tick.ms}-${tick.xPx}`}
              className="absolute top-0 right-0 text-[14px] tabular-nums text-muted"
            >
              {tick.label}
            </span>
          );
        }
        return (
          <span
            key={`${tick.ms}-${tick.xPx}`}
            className="absolute top-0 -translate-x-1/2 text-[14px] tabular-nums text-muted"
            style={{ left: tick.xPx }}
          >
            {tick.label}
          </span>
        );
      })}
    </div>
  );
}
