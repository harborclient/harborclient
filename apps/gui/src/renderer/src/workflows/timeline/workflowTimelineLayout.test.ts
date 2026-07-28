import { describe, expect, it } from 'vitest';
import type { WorkflowAction } from '@harborclient/core/types';
import {
  WORKFLOW_TIMELINE_MIN_BLOCK_WIDTH_PX,
  buildTimelineRulerTicks,
  layoutWorkflowTimeline,
  playbackIndexToTimelineMs,
  playheadXToActionIndex,
  timelineMsToPlayheadX
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

describe('layoutWorkflowTimeline', () => {
  it('uses equal widths when timestamps are missing', () => {
    const actions: WorkflowAction[] = [
      { uuid: 'a1', type: 'tab.new', payload: {} },
      { uuid: 'a2', type: 'tab.new', payload: {} },
      { uuid: 'a3', type: 'tab.new', payload: {} }
    ];
    const layout = layoutWorkflowTimeline(actions, 3000, 300);
    expect(layout.segments).toHaveLength(3);
    expect(layout.segments.every((segment) => segment.widthPx === 100)).toBe(true);
    expect(layout.totalWidthPx).toBe(300);
  });

  it('sizes blocks proportionally to recorded gaps and fits the track exactly', () => {
    const t0 = 1000;
    const actions = [timed(t0), timed(t0 + 100), timed(t0 + 1100)];
    const layout = layoutWorkflowTimeline(actions, 1100, 1100);

    expect(layout.totalWidthPx).toBe(1100);
    expect(layout.segments.reduce((sum, segment) => sum + segment.widthPx, 0)).toBe(1100);
    expect(layout.segments[0]!.widthPx).toBeGreaterThanOrEqual(
      WORKFLOW_TIMELINE_MIN_BLOCK_WIDTH_PX
    );
    expect(layout.segments[1]!.widthPx).toBeGreaterThan(layout.segments[0]!.widthPx);

    const burst = layoutWorkflowTimeline([timed(t0), timed(t0 + 1), timed(t0 + 1000)], 1000, 1000);
    expect(burst.totalWidthPx).toBe(1000);
    expect(burst.segments.reduce((sum, segment) => sum + segment.widthPx, 0)).toBe(1000);
    expect(burst.segments[0]!.widthPx).toBeGreaterThanOrEqual(WORKFLOW_TIMELINE_MIN_BLOCK_WIDTH_PX);
    expect(burst.segments[0]!.widthPx).toBeLessThanOrEqual(
      WORKFLOW_TIMELINE_MIN_BLOCK_WIDTH_PX + 1
    );
    expect(burst.segments[1]!.widthPx).toBeGreaterThan(burst.segments[0]!.widthPx);
  });

  it('still fits when the track is narrower than all minimum block widths', () => {
    const actions = [timed(1), timed(2), timed(3)];
    const layout = layoutWorkflowTimeline(actions, 3, 90);
    expect(layout.totalWidthPx).toBe(90);
    expect(layout.segments.reduce((sum, segment) => sum + segment.widthPx, 0)).toBe(90);
    expect(layout.segments.every((segment) => segment.widthPx === 30)).toBe(true);
  });

  it('maps playhead x and click x consistently', () => {
    const t0 = 5000;
    const actions = [timed(t0), timed(t0 + 2000), timed(t0 + 4000)];
    const layout = layoutWorkflowTimeline(actions, 4000, 400);

    expect(playheadXToActionIndex(layout, 0)).toBe(0);
    expect(playheadXToActionIndex(layout, layout.segments[0]!.widthPx)).toBe(1);

    const midSecond = timelineMsToPlayheadX(layout, 3000);
    expect(playheadXToActionIndex(layout, midSecond)).toBe(1);
  });

  it('maps playback index to timeline offsets', () => {
    const t0 = 10_000;
    const actions = [timed(t0), timed(t0 + 1000), timed(t0 + 2000)];
    expect(playbackIndexToTimelineMs(actions, 2000, 0)).toBe(0);
    expect(playbackIndexToTimelineMs(actions, 2000, 1)).toBe(1000);
    expect(playbackIndexToTimelineMs(actions, 2000, 3)).toBeGreaterThanOrEqual(2000);
  });

  it('builds ruler ticks spanning the duration', () => {
    const ticks = buildTimelineRulerTicks(10_000, 800);
    expect(ticks[0]!.ms).toBe(0);
    expect(ticks[ticks.length - 1]!.ms).toBe(10_000);
    expect(ticks.length).toBeGreaterThan(1);
  });
});
