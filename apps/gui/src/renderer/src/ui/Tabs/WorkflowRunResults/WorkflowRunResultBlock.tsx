import type { WorkflowAction, WorkflowRunActionResult } from '@harborclient/core/types';
import type { JSX } from 'react';
import type { RootState } from '#/renderer/src/store/redux';
import { TimelineBlock } from '#/renderer/src/workflows/timeline/TimelineBlock';
import { WorkflowActionBlockRow } from '#/renderer/src/workflows/timeline/WorkflowActionBlockRow';
import { workflowActionBlockPrimaryLabel } from '#/renderer/src/workflows/timeline/workflowActionBlockPrimaryLabel';

interface Props {
  /**
   * Optional DOM id for aria-activedescendant targeting.
   */
  id?: string;

  /**
   * 1-based execution order index shown as `#N`.
   */
  index: number;

  /**
   * Executed workflow action to render as a timeline block.
   */
  action: WorkflowAction;

  /**
   * Run-log result for this step (request snapshot for sends, payload otherwise).
   */
  result: WorkflowRunActionResult;

  /**
   * ISO-8601 timestamp when this step started executing.
   */
  ranAt: string;

  /**
   * Wall-clock duration of the step in milliseconds.
   */
  durationMs: number;

  /**
   * True when this block is the focused/selected list item.
   */
  selected: boolean;

  /**
   * Redux getState used by registry thumbnails to resolve request/env names.
   */
  getState: () => RootState;

  /**
   * Opens or toggles the detail panel for this executed action.
   */
  onOpen: () => void;
}

/**
 * Interactive timeline block for one executed workflow-run step.
 *
 * Reuses {@link TimelineBlock} + {@link WorkflowActionBlockRow} so Results rows
 * match the footer timeline thumbnail. Height follows content (`fitContent`).
 * Shows `#N` and a ran-at · duration subtitle (hidden on the footer timeline).
 *
 * @param props - Index, action, result, timing, selection, store accessor, and open handler.
 * @returns Full-width, content-sized timeline block option.
 */
export function WorkflowRunResultBlock({
  id,
  index,
  action,
  result,
  ranAt,
  durationMs,
  selected,
  getState,
  onOpen
}: Props): JSX.Element {
  const primaryLabel = workflowActionBlockPrimaryLabel(action, result, getState);
  const date = new Date(ranAt);
  const formattedRanAt = Number.isNaN(date.getTime()) ? ranAt : date.toLocaleString();
  const label = `#${index}, ${primaryLabel}, ${formattedRanAt} · ${durationMs} ms`;

  return (
    <div className="w-full shrink-0">
      <TimelineBlock id={id} label={label} selected={selected} fillWidth fitContent onSeek={onOpen}>
        <WorkflowActionBlockRow
          action={action}
          selected={selected}
          compact={false}
          getState={getState}
          result={result}
          showIndex
          index={index}
          showTiming
          ranAt={ranAt}
          durationMs={durationMs}
        />
      </TimelineBlock>
    </div>
  );
}
