import type { JSX } from 'react';
import type {
  TimingPhaseGroup,
  TimingPhaseRow
} from '#/renderer/src/ui/Main/ResponseEditor/timingDisplay';
import { TimingPhaseRowView } from '#/renderer/src/ui/Main/ResponseEditor/Timing/TimingPhaseRowView';

interface Props {
  /**
   * Section heading to render.
   */
  group: TimingPhaseGroup;
  /**
   * Timing rows belonging to the section.
   */
  rows: TimingPhaseRow[];
  /**
   * Total request duration used to scale waterfall bars.
   */
  totalMs: number;
}

/**
 * Renders grouped timing rows for one section heading.
 */
export function TimingGroup({ group, rows, totalMs }: Props): JSX.Element | null {
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
