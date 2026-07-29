import type { JSX } from 'react';
import {
  buildTimelineRulerTicks,
  type WorkflowTimelineLayout
} from '#/renderer/src/workflows/timeline/workflowTimelineLayout';

interface Props {
  /**
   * Layout geometry used to place ticks (aligned with the playhead).
   */
  layout: WorkflowTimelineLayout;
}

/**
 * Time ruler drawn above the workflow timeline track.
 *
 * Edge ticks align to the start/end of the track so labels do not overflow
 * horizontally; middle ticks stay centered on their marks. Tick X follows
 * segment geometry so equal-width (gapless) and proportional layouts stay aligned.
 *
 * @param props - Timeline layout used to place tick labels.
 * @returns Ruler row with labelled ticks.
 */
export function TimelineRuler({ layout }: Props): JSX.Element {
  /**
   * Derives tick marks for the current layout geometry.
   */
  const ticks = buildTimelineRulerTicks(layout);
  const { totalWidthPx } = layout;

  return (
    <div
      className="relative mb-4 h-6 shrink-0 overflow-hidden border-b border-separator"
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
