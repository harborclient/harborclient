import type { JSX } from 'react';
import type { SendResult } from '#/shared/types';
import { formatBytes } from '#/renderer/src/ui/shared/responseFormatUtils';
import {
  buildTimingRows,
  timingPercent,
  type TimingPhaseGroup,
  type TimingPhaseRow
} from './timingDisplay';

interface Props {
  /**
   * Last send result whose timing phases should be rendered.
   */
  response: SendResult;
}

const BAR_CLASSES: Record<TimingPhaseRow['id'], string> = {
  stalled: 'bg-muted',
  connect: 'bg-info',
  requestSent: 'bg-warning',
  waiting: 'bg-success',
  download: 'bg-info'
};

const GROUP_ORDER: TimingPhaseGroup[] = ['Connection Start', 'Request/Response'];

/**
 * Renders one timing phase row with a Chrome-style waterfall bar.
 *
 * @param row - Timing row to display.
 * @param totalMs - Total request duration used to scale the bar.
 */
function TimingPhaseRowView({
  row,
  totalMs
}: {
  row: TimingPhaseRow;
  totalMs: number;
}): JSX.Element {
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

/**
 * Renders grouped timing rows for one section heading.
 *
 * @param group - Section heading to render.
 * @param rows - Timing rows belonging to the section.
 * @param totalMs - Total request duration used to scale waterfall bars.
 */
function TimingGroup({
  group,
  rows,
  totalMs
}: {
  group: TimingPhaseGroup;
  rows: TimingPhaseRow[];
  totalMs: number;
}): JSX.Element | null {
  if (rows.length === 0) {
    return null;
  }

  return (
    <section className="border-t border-separator pt-3 first:border-t-0 first:pt-0">
      <h3 className="m-0 mb-2 text-[14px] font-medium text-muted">{group}</h3>
      <div>
        {rows.map((row) => (
          <TimingPhaseRowView key={row.id} row={row} totalMs={totalMs} />
        ))}
      </div>
    </section>
  );
}

/**
 * Chrome-style timing breakdown for the last HTTP response.
 */
export function Timing({ response }: Props): JSX.Element {
  const rows = buildTimingRows(response.timing, response.timeMs);
  const rowsByGroup = GROUP_ORDER.map((group) => ({
    group,
    rows: rows.filter((row) => row.group === group)
  }));

  return (
    <div className="flex flex-col gap-4 p-1">
      <div className="flex flex-wrap items-center gap-4 text-text">
        <span>
          Total time: <span className="font-mono text-text-secondary">{response.timeMs} ms</span>
        </span>
        <span>
          Size:{' '}
          <span className="font-mono text-text-secondary">{formatBytes(response.sizeBytes)}</span>
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="m-0 text-muted">Phase timing is unavailable for this response.</p>
      ) : (
        <>
          <div className="grid grid-cols-[minmax(140px,220px)_1fr_72px] items-center gap-3 border-b border-separator pb-1">
            <span className="sr-only">Phase</span>
            <span className="sr-only">Waterfall</span>
            <span className="text-left font-medium uppercase tracking-wide text-muted">
              Duration
            </span>
          </div>
          {rowsByGroup.map(({ group, rows: groupRows }) => (
            <TimingGroup key={group} group={group} rows={groupRows} totalMs={response.timeMs} />
          ))}
          <div className="grid grid-cols-[minmax(140px,220px)_1fr_72px] items-center gap-3 border-t border-separator pt-2">
            <span className="text-[14px] font-medium text-text">Total</span>
            <span aria-hidden="true" />
            <span className="text-right font-mono text-[14px] text-text-secondary">
              {response.timeMs} ms
            </span>
          </div>
        </>
      )}
    </div>
  );
}
