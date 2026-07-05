import type { RequestTimingPhases } from '#/shared/types';

/**
 * Group heading shown above related timing phases in the Timing tab.
 */
export type TimingPhaseGroup = 'Connection Start' | 'Request/Response';

/**
 * One row in the Chrome-style timing waterfall.
 */
export interface TimingPhaseRow {
  /**
   * Stable row identifier used for React keys and bar styling.
   */
  id: 'stalled' | 'connect' | 'requestSent' | 'waiting' | 'download';

  /**
   * Section heading for this row.
   */
  group: TimingPhaseGroup;

  /**
   * Human-readable phase label shown beside the waterfall bar.
   */
  label: string;

  /**
   * Phase duration in milliseconds.
   */
  durationMs: number;

  /**
   * Offset from request start when this phase begins.
   */
  startMs: number;
}

interface PhaseDefinition {
  /**
   * Stable row identifier.
   */
  id: TimingPhaseRow['id'];

  /**
   * Section heading for this phase.
   */
  group: TimingPhaseGroup;

  /**
   * Human-readable phase label.
   */
  label: string;

  /**
   * Optional duration read from {@link RequestTimingPhases}.
   */
  value: number | undefined;
}

/**
 * Builds ordered timing rows with cumulative start offsets for waterfall rendering.
 *
 * @param timing - Best-effort phase timing from the last send result.
 * @param totalMs - Total request duration used to scale waterfall bars.
 * @returns Rows with only phases that were captured for this response.
 */
export function buildTimingRows(
  timing: RequestTimingPhases | undefined,
  totalMs: number
): TimingPhaseRow[] {
  if (!timing) {
    return [];
  }

  const definitions: PhaseDefinition[] = [
    { id: 'stalled', group: 'Connection Start', label: 'Stalled', value: timing.stalledMs },
    { id: 'connect', group: 'Connection Start', label: 'Connect', value: timing.connectMs },
    {
      id: 'requestSent',
      group: 'Request/Response',
      label: 'Request sent',
      value: timing.requestSentMs
    },
    {
      id: 'waiting',
      group: 'Request/Response',
      label: 'Waiting for server response',
      value: timing.waitingMs
    },
    {
      id: 'download',
      group: 'Request/Response',
      label: 'Content download',
      value: timing.downloadMs
    }
  ];

  let startMs = 0;
  const rows: TimingPhaseRow[] = [];

  for (const definition of definitions) {
    if (definition.value == null) {
      continue;
    }

    const durationMs = Math.max(0, Math.round(definition.value));
    rows.push({
      id: definition.id,
      group: definition.group,
      label: definition.label,
      durationMs,
      startMs
    });
    startMs += durationMs;
  }

  if (rows.length === 0 || totalMs <= 0) {
    return rows;
  }

  return rows;
}

/**
 * Converts a millisecond offset into a percentage of the total request duration.
 *
 * @param valueMs - Offset or duration in milliseconds.
 * @param totalMs - Total request duration in milliseconds.
 * @returns Percentage between 0 and 100.
 */
export function timingPercent(valueMs: number, totalMs: number): number {
  if (totalMs <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, (valueMs / totalMs) * 100));
}
