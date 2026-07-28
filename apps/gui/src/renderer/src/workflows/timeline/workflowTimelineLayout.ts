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
   * Pixel width after fitting to the track (includes min-width enforcement).
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
   * Total pixel width of all segments (always equals the track viewport width when
   * there is at least one action).
   */
  totalWidthPx: number;

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
 * Distributes integer pixel widths that sum exactly to `trackWidthPx`.
 *
 * Prefers duration-proportional shares with a minimum per segment when the track
 * is wide enough; otherwise splits the track into equal-width segments.
 *
 * @param durations - Per-segment duration weights (must be positive).
 * @param trackWidthPx - Exact pixel budget for the full track.
 * @returns Integer widths summing to `trackWidthPx`.
 */
function distributeSegmentWidths(durations: readonly number[], trackWidthPx: number): number[] {
  const count = durations.length;
  if (count === 0) {
    return [];
  }

  const safeTrack = Math.max(1, Math.floor(trackWidthPx));
  const minWidth = WORKFLOW_TIMELINE_MIN_BLOCK_WIDTH_PX;

  if (safeTrack < count * minWidth) {
    const base = Math.floor(safeTrack / count);
    const remainder = safeTrack - base * count;
    return durations.map((_, i) => base + (i < remainder ? 1 : 0));
  }

  const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);
  const freeBudget = safeTrack - count * minWidth;
  const shares = durations.map((duration) => (duration / totalDuration) * freeBudget);
  const floors = shares.map((share) => Math.floor(share));
  const remainders = shares
    .map((share, i) => ({ i, frac: share - floors[i]! }))
    .sort((a, b) => b.frac - a.frac);

  const extras = new Array<number>(count).fill(0);
  const leftover = freeBudget - floors.reduce((sum, floor) => sum + floor, 0);
  for (let n = 0; n < leftover; n += 1) {
    const entry = remainders[n % remainders.length];
    if (entry == null) {
      break;
    }
    extras[entry.i]! += 1;
  }

  return durations.map((_, i) => minWidth + floors[i]! + extras[i]!);
}

/**
 * Lays out timeline segments for a track of the given pixel width.
 *
 * Durations are proportional to recorded gaps when `at` is present. Each block
 * is at least {@link WORKFLOW_TIMELINE_MIN_BLOCK_WIDTH_PX} wide when the track
 * allows it. Segment widths always sum exactly to `trackWidthPx` (no overflow).
 *
 * @param actions - Workflow actions in play order.
 * @param durationMs - Saved workflow duration in milliseconds.
 * @param trackWidthPx - Available viewport width for the track.
 * @returns Segment geometry and totals.
 */
export function layoutWorkflowTimeline(
  actions: readonly WorkflowAction[],
  durationMs: number,
  trackWidthPx: number
): WorkflowTimelineLayout {
  const { starts, ends, totalDurationMs } = buildSegmentRanges(actions, durationMs);
  const count = actions.length;
  if (count === 0) {
    return {
      totalDurationMs,
      totalWidthPx: Math.max(0, trackWidthPx),
      segments: []
    };
  }

  const safeTrack = Math.max(1, Math.floor(trackWidthPx));
  const durations = starts.map((start, i) => Math.max(1, ends[i]! - start));
  const widths = distributeSegmentWidths(durations, safeTrack);

  const segments: WorkflowTimelineSegment[] = starts.map((start, i) => ({
    index: i,
    startMs: start,
    endMs: ends[i]!,
    durationMs: Math.max(1, ends[i]! - start),
    widthPx: widths[i]!
  }));

  return { totalDurationMs, totalWidthPx: safeTrack, segments };
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
  let x = 0;
  for (const segment of layout.segments) {
    if (clamped <= segment.startMs) {
      return x;
    }
    if (clamped >= segment.endMs) {
      x += segment.widthPx;
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
 * @param layout - Result of {@link layoutWorkflowTimeline}.
 * @param xPx - Click X within the scrollable track content.
 * @returns Action index, or null when there are no segments.
 */
export function playheadXToActionIndex(layout: WorkflowTimelineLayout, xPx: number): number | null {
  if (layout.segments.length === 0) {
    return null;
  }
  let x = 0;
  for (const segment of layout.segments) {
    const next = x + segment.widthPx;
    if (xPx < next) {
      return segment.index;
    }
    x = next;
  }
  return layout.segments[layout.segments.length - 1]!.index;
}

/**
 * Returns tick marks for the timeline ruler.
 *
 * @param totalDurationMs - Full timeline duration.
 * @param totalWidthPx - Full track content width.
 * @returns Labelled tick positions in pixels.
 */
export function buildTimelineRulerTicks(
  totalDurationMs: number,
  totalWidthPx: number
): { xPx: number; label: string; ms: number }[] {
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
    const xPx = (clamped / totalDurationMs) * totalWidthPx;
    const seconds = clamped / 1000;
    const label =
      seconds >= 60
        ? `${Math.floor(seconds / 60)}m${String(Math.floor(seconds % 60)).padStart(2, '0')}s`
        : `${Math.round(seconds * 10) / 10}s`;
    ticks.push({ xPx, label, ms: clamped });
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
  const layout = layoutWorkflowTimeline(actions, durationMs, 1000);
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
