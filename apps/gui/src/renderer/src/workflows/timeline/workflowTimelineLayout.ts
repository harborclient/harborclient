import type { WorkflowAction } from '@harborclient/core/types';

/**
 * Minimum pixel width for a timeline block so rapid bursts stay clickable.
 */
export const WORKFLOW_TIMELINE_MIN_BLOCK_WIDTH_PX = 48;

/**
 * Width at or below which thumbnails should drop secondary text.
 */
export const WORKFLOW_TIMELINE_COMPACT_WIDTH_PX = 96;

/**
 * Fixed pixel width for each block in gapless (equal-width) mode.
 */
export const WORKFLOW_TIMELINE_GAPLESS_BLOCK_WIDTH_PX = 250;

/**
 * Pixels per millisecond for duration-based (gapped) block sizing.
 * 0.25 → 250px per second, matching one gapless block width per second.
 */
export const WORKFLOW_TIMELINE_PX_PER_MS = 0.25;

/**
 * Minimum horizontal gap between adjacent timeline blocks, in pixels
 * (when playback delay is 0).
 */
export const WORKFLOW_TIMELINE_BLOCK_GAP_MIN_PX = 4;

/**
 * Maximum horizontal gap between adjacent timeline blocks, in pixels
 * (when playback delay is at or above {@link WORKFLOW_TIMELINE_BLOCK_GAP_MAX_DELAY_MS}).
 */
export const WORKFLOW_TIMELINE_BLOCK_GAP_MAX_PX = 18;

/**
 * Playback delay (ms) at which the inter-block gap reaches its maximum pixel size.
 */
export const WORKFLOW_TIMELINE_BLOCK_GAP_MAX_DELAY_MS = 5000;

/**
 * Default inter-block gap when delay is omitted (same as the minimum).
 */
export const WORKFLOW_TIMELINE_BLOCK_GAP_PX = WORKFLOW_TIMELINE_BLOCK_GAP_MIN_PX;

/**
 * Maps a playback delay to the pixel gap between adjacent timeline blocks.
 *
 * Scales linearly from {@link WORKFLOW_TIMELINE_BLOCK_GAP_MIN_PX} at 0 ms to
 * {@link WORKFLOW_TIMELINE_BLOCK_GAP_MAX_PX} at
 * {@link WORKFLOW_TIMELINE_BLOCK_GAP_MAX_DELAY_MS} (and above).
 *
 * @param delayMs - Workflow playback delay in milliseconds.
 * @returns Gap width in whole pixels.
 */
export function workflowTimelineBlockGapPx(delayMs: number): number {
  const safeDelay =
    typeof delayMs === 'number' && Number.isFinite(delayMs) ? Math.max(0, delayMs) : 0;
  const t = Math.min(safeDelay, WORKFLOW_TIMELINE_BLOCK_GAP_MAX_DELAY_MS);
  const span = WORKFLOW_TIMELINE_BLOCK_GAP_MAX_PX - WORKFLOW_TIMELINE_BLOCK_GAP_MIN_PX;
  return Math.round(
    WORKFLOW_TIMELINE_BLOCK_GAP_MIN_PX + (span * t) / WORKFLOW_TIMELINE_BLOCK_GAP_MAX_DELAY_MS
  );
}

/**
 * One action's segment on the recorded timeline.
 */
export interface WorkflowTimelineSegment {
  /**
   * 0-based action index.
   */
  index: number;

  /**
   * Start offset in milliseconds from the timeline origin.
   */
  startMs: number;

  /**
   * End offset in milliseconds from the timeline origin.
   */
  endMs: number;

  /**
   * Segment duration in milliseconds (at least 1 when timed).
   */
  durationMs: number;

  /**
   * Absolute pixel width (gapless fixed size or duration-scaled with min floor).
   */
  widthPx: number;
}

/**
 * Layout result for a workflow timeline track.
 */
export interface WorkflowTimelineLayout {
  /**
   * Total recorded duration represented by the track.
   */
  totalDurationMs: number;

  /**
   * Total pixel width of the track (blocks plus inter-block gaps). May exceed
   * the viewport so the timeline can scroll horizontally.
   */
  totalWidthPx: number;

  /**
   * Horizontal gap between adjacent blocks, derived from playback delay.
   */
  gapPx: number;

  /**
   * Per-action segments with pixel widths.
   */
  segments: WorkflowTimelineSegment[];
}

/**
 * Returns whether every action has a usable `at` timestamp.
 *
 * @param actions - Loaded workflow actions.
 * @returns True when all actions define a finite `at`.
 */
function allActionsHaveAt(actions: readonly WorkflowAction[]): boolean {
  return actions.every((action) => typeof action.at === 'number' && Number.isFinite(action.at));
}

/**
 * Builds start/end millisecond ranges for each action.
 *
 * Timed mode uses recorded `at` values. Untimed mode splits `durationMs`
 * (or a unit length) into equal segments.
 *
 * @param actions - Workflow actions in play order.
 * @param durationMs - Workflow total duration from the saved record.
 * @returns Parallel arrays of startMs / endMs, plus total duration.
 */
function buildSegmentRanges(
  actions: readonly WorkflowAction[],
  durationMs: number
): { starts: number[]; ends: number[]; totalDurationMs: number } {
  const count = actions.length;
  if (count === 0) {
    return { starts: [], ends: [], totalDurationMs: Math.max(0, durationMs) };
  }

  if (allActionsHaveAt(actions)) {
    const origin = actions[0]!.at as number;
    const starts = actions.map((action) => Math.max(0, (action.at as number) - origin));
    const lastAt = actions[count - 1]!.at as number;
    const recordedEnd = Math.max(durationMs, lastAt - origin);
    const ends: number[] = [];
    for (let i = 0; i < count; i += 1) {
      const nextStart = i + 1 < count ? starts[i + 1]! : Math.max(starts[i]! + 1, recordedEnd);
      ends.push(Math.max(starts[i]! + 1, nextStart));
    }
    const totalDurationMs = Math.max(ends[count - 1]!, recordedEnd, 1);
    return { starts, ends, totalDurationMs };
  }

  const totalDurationMs = Math.max(durationMs, count, 1);
  const slice = totalDurationMs / count;
  const starts: number[] = [];
  const ends: number[] = [];
  for (let i = 0; i < count; i += 1) {
    starts.push(i * slice);
    ends.push((i + 1) * slice);
  }
  return { starts, ends, totalDurationMs };
}

/**
 * Converts a segment duration to an absolute pixel width for gapped timelines.
 *
 * @param durationMs - Segment duration in milliseconds (must be positive).
 * @returns Width in whole pixels, floored at the minimum block width.
 */
function durationToWidthPx(durationMs: number): number {
  return Math.max(
    WORKFLOW_TIMELINE_MIN_BLOCK_WIDTH_PX,
    Math.round(durationMs * WORKFLOW_TIMELINE_PX_PER_MS)
  );
}

/**
 * Pixel budget consumed by gaps between `count` blocks (no trailing gap).
 *
 * @param count - Number of timeline blocks.
 * @param gapPx - Pixel gap between adjacent blocks.
 * @returns Total gap pixels, or 0 when fewer than two blocks.
 */
function interBlockGapTotalPx(count: number, gapPx: number): number {
  return count > 1 ? (count - 1) * gapPx : 0;
}

/**
 * Lays out timeline segments with absolute pixel widths (scrollable track).
 *
 * When `equalWidths` is false (gapped playback), each block width scales with
 * segment duration at {@link WORKFLOW_TIMELINE_PX_PER_MS}, floored at
 * {@link WORKFLOW_TIMELINE_MIN_BLOCK_WIDTH_PX}. When `equalWidths` is true
 * (gapless), every block is {@link WORKFLOW_TIMELINE_GAPLESS_BLOCK_WIDTH_PX}
 * wide. Segment time ranges stay recorded-based in both modes. Total track
 * width is the sum of block widths plus delay-derived gaps and may exceed the
 * viewport.
 *
 * @param actions - Workflow actions in play order.
 * @param durationMs - Saved workflow duration in milliseconds.
 * @param equalWidths - When true, use the fixed gapless block width.
 * @param delayMs - Playback delay used to size the inter-block gap (default 0 → min gap).
 * @returns Segment geometry and totals.
 */
export function layoutWorkflowTimeline(
  actions: readonly WorkflowAction[],
  durationMs: number,
  equalWidths = false,
  delayMs = 0
): WorkflowTimelineLayout {
  const gapPx = workflowTimelineBlockGapPx(delayMs);
  const { starts, ends, totalDurationMs } = buildSegmentRanges(actions, durationMs);
  const count = actions.length;
  if (count === 0) {
    return {
      totalDurationMs,
      totalWidthPx: 0,
      gapPx,
      segments: []
    };
  }

  const segments: WorkflowTimelineSegment[] = starts.map((start, i) => {
    const duration = Math.max(1, ends[i]! - start);
    return {
      index: i,
      startMs: start,
      endMs: ends[i]!,
      durationMs: duration,
      widthPx: equalWidths ? WORKFLOW_TIMELINE_GAPLESS_BLOCK_WIDTH_PX : durationToWidthPx(duration)
    };
  });

  const widthsTotal = segments.reduce((sum, segment) => sum + segment.widthPx, 0);
  const totalWidthPx = widthsTotal + interBlockGapTotalPx(count, gapPx);

  return { totalDurationMs, totalWidthPx, gapPx, segments };
}

/**
 * Maps a recorded timeline offset to a playhead X position within the layout.
 *
 * @param layout - Result of {@link layoutWorkflowTimeline}.
 * @param timelineMs - Offset from the recording origin in milliseconds.
 * @returns Pixel X from the start of the track.
 */
export function timelineMsToPlayheadX(layout: WorkflowTimelineLayout, timelineMs: number): number {
  if (layout.segments.length === 0 || layout.totalDurationMs <= 0) {
    return 0;
  }

  const clamped = Math.min(Math.max(timelineMs, 0), layout.totalDurationMs);
  const gap = layout.gapPx;
  let x = 0;
  for (let i = 0; i < layout.segments.length; i += 1) {
    const segment = layout.segments[i]!;
    if (clamped <= segment.startMs) {
      return x;
    }
    if (clamped >= segment.endMs) {
      x += segment.widthPx;
      if (i < layout.segments.length - 1) {
        x += gap;
      }
      continue;
    }
    const local = (clamped - segment.startMs) / segment.durationMs;
    return x + local * segment.widthPx;
  }
  return layout.totalWidthPx;
}

/**
 * Maps a click X (relative to the track content) to the nearest action index.
 *
 * Clicks that land in an inter-block gap resolve to the following block.
 *
 * @param layout - Result of {@link layoutWorkflowTimeline}.
 * @param xPx - Click X within the scrollable track content.
 * @returns Action index, or null when there are no segments.
 */
export function playheadXToActionIndex(layout: WorkflowTimelineLayout, xPx: number): number | null {
  if (layout.segments.length === 0) {
    return null;
  }
  const gap = layout.gapPx;
  let x = 0;
  for (let i = 0; i < layout.segments.length; i += 1) {
    const segment = layout.segments[i]!;
    const next = x + segment.widthPx;
    if (xPx < next) {
      return segment.index;
    }
    x = next;
    if (i < layout.segments.length - 1) {
      x += gap;
      if (xPx < x) {
        return layout.segments[i + 1]!.index;
      }
    }
  }
  return layout.segments[layout.segments.length - 1]!.index;
}

/**
 * Formats a timeline offset as a compact ruler label.
 *
 * @param ms - Offset in milliseconds.
 * @returns Human-readable label (e.g. `1.5s`, `1m05s`).
 */
function formatRulerTickLabel(ms: number): string {
  const seconds = ms / 1000;
  if (seconds >= 60) {
    return `${Math.floor(seconds / 60)}m${String(Math.floor(seconds % 60)).padStart(2, '0')}s`;
  }
  return `${Math.round(seconds * 10) / 10}s`;
}

/**
 * Returns tick marks for the timeline ruler.
 *
 * Tick X positions follow {@link timelineMsToPlayheadX} so labels stay aligned
 * with the playhead under both proportional and equal-width layouts.
 *
 * @param layout - Result of {@link layoutWorkflowTimeline}.
 * @returns Labelled tick positions in pixels.
 */
export function buildTimelineRulerTicks(
  layout: WorkflowTimelineLayout
): { xPx: number; label: string; ms: number }[] {
  const { totalDurationMs, totalWidthPx } = layout;
  if (totalDurationMs <= 0 || totalWidthPx <= 0) {
    return [{ xPx: 0, label: '0s', ms: 0 }];
  }

  const targetTickCount = Math.max(2, Math.min(12, Math.floor(totalWidthPx / 80)));
  const roughStep = totalDurationMs / targetTickCount;
  const niceSteps = [250, 500, 1000, 2000, 5000, 10000, 15000, 30000, 60000, 120000, 300000];
  const stepMs = niceSteps.find((step) => step >= roughStep) ?? niceSteps[niceSteps.length - 1]!;

  const ticks: { xPx: number; label: string; ms: number }[] = [];
  for (let ms = 0; ms <= totalDurationMs + 0.5; ms += stepMs) {
    const clamped = Math.min(ms, totalDurationMs);
    const xPx = timelineMsToPlayheadX(layout, clamped);
    ticks.push({ xPx, label: formatRulerTickLabel(clamped), ms: clamped });
    if (clamped >= totalDurationMs) {
      break;
    }
  }
  return ticks;
}

/**
 * Derives the recorded timeline offset for the current playback cursor.
 *
 * @param actions - Loaded actions.
 * @param durationMs - Workflow duration.
 * @param index - Current playback index (next action to play).
 * @returns Milliseconds from the recording origin.
 */
export function playbackIndexToTimelineMs(
  actions: readonly WorkflowAction[],
  durationMs: number,
  index: number
): number {
  const layout = layoutWorkflowTimeline(actions, durationMs);
  if (layout.segments.length === 0) {
    return 0;
  }
  if (index <= 0) {
    return 0;
  }
  if (index >= layout.segments.length) {
    return layout.totalDurationMs;
  }
  return layout.segments[index]!.startMs;
}
