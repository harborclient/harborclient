import { describe, expect, it } from 'vitest';
import type { WorkflowAction } from '@harborclient/core/types';
import {
  WORKFLOW_TIMELINE_BLOCK_GAP_MAX_PX,
  WORKFLOW_TIMELINE_BLOCK_GAP_MIN_PX,
  WORKFLOW_TIMELINE_BLOCK_GAP_PX,
  WORKFLOW_TIMELINE_GAPLESS_BLOCK_WIDTH_PX,
  WORKFLOW_TIMELINE_MIN_BLOCK_WIDTH_PX,
  WORKFLOW_TIMELINE_PX_PER_MS,
  buildTimelineRulerTicks,
  layoutWorkflowTimeline,
  playbackIndexToTimelineMs,
  playheadXToActionIndex,
  timelineMsToPlayheadX,
  workflowTimelineBlockGapPx
} from './workflowTimelineLayout';

/**
 * Builds a timed action fixture.
 *
 * @param at - Absolute wall-clock timestamp.
 * @param type - Logical event type.
 * @returns Workflow action.
 */
function timed(at: number, type = 'environment.activate'): WorkflowAction {
  return { uuid: `timed-${at}`, type, at, payload: {} };
}

/**
 * Sums block widths plus inter-block gaps for a layout.
 *
 * @param layout - Layout under test.
 * @returns Pixel span of blocks and gaps.
 */
function occupiedWidthPx(layout: { gapPx: number; segments: { widthPx: number }[] }): number {
  const count = layout.segments.length;
  if (count === 0) {
    return 0;
  }
  const widths = layout.segments.reduce((sum, segment) => sum + segment.widthPx, 0);
  return widths + (count - 1) * layout.gapPx;
}

/**
 * Expected duration-based block width for gapped timelines.
 *
 * @param durationMs - Segment duration in milliseconds.
 * @returns Absolute pixel width with the minimum floor.
 */
function expectedTimedWidthPx(durationMs: number): number {
  return Math.max(
    WORKFLOW_TIMELINE_MIN_BLOCK_WIDTH_PX,
    Math.round(durationMs * WORKFLOW_TIMELINE_PX_PER_MS)
  );
}

describe('workflowTimelineBlockGapPx', () => {
  it('maps 0 ms to the minimum gap', () => {
    expect(workflowTimelineBlockGapPx(0)).toBe(WORKFLOW_TIMELINE_BLOCK_GAP_MIN_PX);
    expect(workflowTimelineBlockGapPx(0)).toBe(WORKFLOW_TIMELINE_BLOCK_GAP_PX);
  });

  it('maps 5000 ms to the maximum gap', () => {
    expect(workflowTimelineBlockGapPx(5000)).toBe(WORKFLOW_TIMELINE_BLOCK_GAP_MAX_PX);
  });

  it('maps 2500 ms to the midpoint', () => {
    expect(workflowTimelineBlockGapPx(2500)).toBe(11);
  });

  it('clamps delays above 5000 ms to the maximum gap', () => {
    expect(workflowTimelineBlockGapPx(10_000)).toBe(WORKFLOW_TIMELINE_BLOCK_GAP_MAX_PX);
  });

  it('treats invalid delays as 0', () => {
    expect(workflowTimelineBlockGapPx(Number.NaN)).toBe(WORKFLOW_TIMELINE_BLOCK_GAP_MIN_PX);
    expect(workflowTimelineBlockGapPx(-100)).toBe(WORKFLOW_TIMELINE_BLOCK_GAP_MIN_PX);
  });
});

describe('layoutWorkflowTimeline', () => {
  it('sizes untimed blocks from equal duration slices and reserves inter-block gaps', () => {
    const actions: WorkflowAction[] = [
      { uuid: 'a1', type: 'tab.new', payload: {} },
      { uuid: 'a2', type: 'tab.new', payload: {} },
      { uuid: 'a3', type: 'tab.new', payload: {} }
    ];
    const layout = layoutWorkflowTimeline(actions, 3000);
    expect(layout.segments).toHaveLength(3);
    expect(layout.gapPx).toBe(WORKFLOW_TIMELINE_BLOCK_GAP_MIN_PX);
    expect(layout.totalWidthPx).toBe(occupiedWidthPx(layout));
    for (const segment of layout.segments) {
      expect(segment.widthPx).toBe(expectedTimedWidthPx(segment.durationMs));
      expect(segment.durationMs).toBe(1000);
    }
  });

  it('sizes blocks from recorded durations without fitting a viewport', () => {
    const t0 = 1000;
    const actions = [timed(t0), timed(t0 + 100), timed(t0 + 1100)];
    const layout = layoutWorkflowTimeline(actions, 1100);

    expect(layout.segments[0]!.durationMs).toBe(100);
    expect(layout.segments[1]!.durationMs).toBe(1000);
    expect(layout.segments[0]!.widthPx).toBe(expectedTimedWidthPx(100));
    expect(layout.segments[1]!.widthPx).toBe(expectedTimedWidthPx(1000));
    expect(layout.segments[1]!.widthPx).toBeGreaterThan(layout.segments[0]!.widthPx);
    expect(layout.totalWidthPx).toBe(occupiedWidthPx(layout));
    expect(layout.totalWidthPx).toBe(
      expectedTimedWidthPx(100) +
        expectedTimedWidthPx(1000) +
        expectedTimedWidthPx(1) +
        2 * layout.gapPx
    );

    const burst = layoutWorkflowTimeline([timed(t0), timed(t0 + 1), timed(t0 + 1000)], 1000);
    expect(burst.segments[0]!.widthPx).toBe(WORKFLOW_TIMELINE_MIN_BLOCK_WIDTH_PX);
    expect(burst.segments[1]!.widthPx).toBe(expectedTimedWidthPx(999));
  });

  it('uses a fixed 250px width for every block when equalWidths is true', () => {
    const t0 = 1000;
    const actions = [timed(t0), timed(t0 + 100), timed(t0 + 1100)];
    const equal = layoutWorkflowTimeline(actions, 1100, true);

    expect(equal.totalWidthPx).toBe(3 * WORKFLOW_TIMELINE_GAPLESS_BLOCK_WIDTH_PX + 2 * equal.gapPx);
    expect(occupiedWidthPx(equal)).toBe(equal.totalWidthPx);
    for (const segment of equal.segments) {
      expect(segment.widthPx).toBe(WORKFLOW_TIMELINE_GAPLESS_BLOCK_WIDTH_PX);
    }
    // Time ranges stay recorded-based even when pixel widths are equal.
    expect(equal.segments[0]!.durationMs).toBe(100);
    expect(equal.segments[1]!.durationMs).toBe(1000);
  });

  it('returns zero total width when there are no actions', () => {
    const layout = layoutWorkflowTimeline([], 0);
    expect(layout.totalWidthPx).toBe(0);
    expect(layout.segments).toHaveLength(0);
  });

  it('widens inter-block gaps when delayMs is 5000 and keeps playhead mapping aligned', () => {
    const t0 = 5000;
    const actions = [timed(t0), timed(t0 + 2000), timed(t0 + 4000)];
    const layout = layoutWorkflowTimeline(actions, 4000, false, 5000);

    expect(layout.gapPx).toBe(WORKFLOW_TIMELINE_BLOCK_GAP_MAX_PX);
    expect(layout.totalWidthPx).toBe(occupiedWidthPx(layout));
    expect(layout.segments[0]!.widthPx).toBe(expectedTimedWidthPx(2000));

    expect(playheadXToActionIndex(layout, 0)).toBe(0);
    expect(playheadXToActionIndex(layout, layout.segments[0]!.widthPx)).toBe(1);
    expect(playheadXToActionIndex(layout, layout.segments[0]!.widthPx + layout.gapPx / 2)).toBe(1);

    const endOfFirst = timelineMsToPlayheadX(layout, 2000);
    expect(endOfFirst).toBe(layout.segments[0]!.widthPx + layout.gapPx);
  });

  it('maps playhead x and click x consistently across gaps', () => {
    const t0 = 5000;
    const actions = [timed(t0), timed(t0 + 2000), timed(t0 + 4000)];
    const layout = layoutWorkflowTimeline(actions, 4000);

    expect(playheadXToActionIndex(layout, 0)).toBe(0);
    expect(playheadXToActionIndex(layout, layout.segments[0]!.widthPx)).toBe(1);
    expect(playheadXToActionIndex(layout, layout.segments[0]!.widthPx + layout.gapPx / 2)).toBe(1);

    const midSecond = timelineMsToPlayheadX(layout, 3000);
    expect(playheadXToActionIndex(layout, midSecond)).toBe(1);

    const endOfFirst = timelineMsToPlayheadX(layout, 2000);
    expect(endOfFirst).toBe(layout.segments[0]!.widthPx + layout.gapPx);
  });

  it('maps playhead x and click x consistently under equal widths', () => {
    const t0 = 5000;
    const actions = [timed(t0), timed(t0 + 100), timed(t0 + 4000)];
    const layout = layoutWorkflowTimeline(actions, 4000, true);

    expect(playheadXToActionIndex(layout, 0)).toBe(0);
    expect(playheadXToActionIndex(layout, layout.segments[0]!.widthPx)).toBe(1);

    const midSecond = timelineMsToPlayheadX(layout, 2000);
    expect(playheadXToActionIndex(layout, midSecond)).toBe(1);

    const endOfFirst = timelineMsToPlayheadX(layout, 100);
    expect(endOfFirst).toBe(layout.segments[0]!.widthPx + layout.gapPx);
  });

  it('maps playback index to timeline offsets', () => {
    const t0 = 10_000;
    const actions = [timed(t0), timed(t0 + 1000), timed(t0 + 2000)];
    expect(playbackIndexToTimelineMs(actions, 2000, 0)).toBe(0);
    expect(playbackIndexToTimelineMs(actions, 2000, 1)).toBe(1000);
    expect(playbackIndexToTimelineMs(actions, 2000, 3)).toBeGreaterThanOrEqual(2000);
  });

  it('builds ruler ticks spanning the duration aligned with the playhead', () => {
    const t0 = 1000;
    const actions = [timed(t0), timed(t0 + 100), timed(t0 + 10_000)];
    const layout = layoutWorkflowTimeline(actions, 10_000, true);
    const ticks = buildTimelineRulerTicks(layout);
    expect(ticks[0]!.ms).toBe(0);
    expect(ticks[ticks.length - 1]!.ms).toBe(10_000);
    expect(ticks.length).toBeGreaterThan(1);
    for (const tick of ticks) {
      expect(tick.xPx).toBe(timelineMsToPlayheadX(layout, tick.ms));
    }
  });
});
