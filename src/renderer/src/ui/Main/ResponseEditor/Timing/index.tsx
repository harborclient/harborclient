import type { JSX } from 'react';
import type { SendResult } from '#/shared/types';
import { formatBytes } from '#/renderer/src/ui/Shared/responseFormatUtils';
import {
  buildTimingRows,
  type TimingPhaseGroup
} from '#/renderer/src/ui/Main/ResponseEditor/timingDisplay';
import { TimingGroup } from '#/renderer/src/ui/Main/ResponseEditor/Timing/TimingGroup';

interface Props {
  /**
   * Last send result whose timing phases should be rendered.
   */
  response: SendResult;
}

const GROUP_ORDER: TimingPhaseGroup[] = ['Connection Start', 'Request/Response'];

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
