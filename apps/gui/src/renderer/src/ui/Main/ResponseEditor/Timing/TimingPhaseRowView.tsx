import type { JSX } from 'react';
import {
  timingPercent,
  type TimingPhaseRow
} from '#/renderer/src/ui/Main/ResponseEditor/timingDisplay';

const BAR_CLASSES: Record<TimingPhaseRow['id'], string> = {
  stalled: 'bg-muted',
  connect: 'bg-info',
  requestSent: 'bg-warning',
  waiting: 'bg-success',
  download: 'bg-info'
};

interface Props {
  /**
   * Timing row to display.
   */
  row: TimingPhaseRow;
  /**
   * Total request duration used to scale the bar.
   */
  totalMs: number;
}

/**
 * Renders one timing phase row with a Chrome-style waterfall bar.
 */
export function TimingPhaseRowView({ row, totalMs }: Props): JSX.Element {
  const leftPercent = timingPercent(row.startMs, totalMs);
  const widthPercent = timingPercent(row.durationMs, totalMs);

  return (
    <div className="grid grid-cols-[minmax(140px,220px)_1fr_72px] items-center gap-3 py-1.5">
      <span className="text-text">{row.label}</span>
      <div
        className="relative h-5 rounded-sm bg-control"
        role="img"
        aria-label={`${row.label}: ${row.durationMs} milliseconds`}
      >
        <div
          className={`absolute inset-y-0 min-w-[2px] rounded-sm ${BAR_CLASSES[row.id]}`}
          style={{
            left: `${leftPercent}%`,
            width: `${Math.max(widthPercent, row.durationMs > 0 ? 0.5 : 0)}%`
          }}
        />
      </div>
      <span className="text-right font-mono text-text-secondary">{row.durationMs} ms</span>
    </div>
  );
}
