import type { WorkflowAction, WorkflowRunActionResult } from '@harborclient/core/types';
import { SidebarRequestItem } from '@harborclient/sdk/components';
import type { JSX, ReactNode } from 'react';
import type { RootState } from '#/renderer/src/store/redux';
import { TimelineBlock } from '#/renderer/src/workflows/timeline/TimelineBlock';
import { describeWorkflowAction } from '#/renderer/src/workflows/timeline/workflowThumbnails';
import { getWorkflowRegistryEntry } from '#/renderer/src/workflows/workflowRegistry';
import { isWorkflowRunRequestResult } from '#/renderer/src/workflows/isWorkflowRunRequestResult';
import { WorkflowRunRequestStatus } from './WorkflowRunRequestStatus';

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
 * Formats a step start timestamp for the Results subtitle.
 *
 * @param ranAt - ISO-8601 timestamp from the run log.
 * @returns Locale-formatted date/time string.
 */
function formatStepRanAt(ranAt: string): string {
  const date = new Date(ranAt);
  if (Number.isNaN(date.getTime())) {
    return ranAt;
  }
  return date.toLocaleString();
}

/**
 * Interactive timeline block for one executed workflow-run step.
 *
 * Reuses TimelineBlock + registry thumbnail chrome from the run dialog preview
 * so Results rows match the visual language of the workflow timeline. Height
 * follows content (`fitContent`) so vertical lists do not stretch rows.
 * Send steps with a request result snapshot use {@link SidebarRequestItem}.
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
  const entry = getWorkflowRegistryEntry(action.type);
  const requestResult =
    action.type === 'request.send' && isWorkflowRunRequestResult(result) ? result : null;
  const described = describeWorkflowAction(action, {
    selected,
    compact: false,
    getState
  });
  const primaryLabel =
    requestResult != null
      ? `${requestResult.method} ${requestResult.name}`
      : described.subtitle != null && described.subtitle.length > 0
        ? `${described.title}, ${described.subtitle}`
        : described.title;
  const subtitle = `${formatStepRanAt(ranAt)} · ${durationMs} ms`;
  const label = `#${index}, ${primaryLabel}, ${subtitle}`;

  const thumbnail: ReactNode =
    requestResult != null ? (
      <SidebarRequestItem
        as="div"
        method={requestResult.method}
        name={requestResult.name}
        className="pl-0 hover:bg-transparent [&_.hc-method-badge]:pl-0"
        actions={<WorkflowRunRequestStatus result={requestResult} className="ms-auto" />}
      />
    ) : (
      (entry?.thumbnail(action, {
        selected,
        compact: false,
        getState
      }) ?? <span className="truncate">{described.title}</span>)
    );

  return (
    <div className="w-full shrink-0">
      <TimelineBlock id={id} label={label} selected={selected} fillWidth fitContent onSeek={onOpen}>
        <div className="flex w-full min-w-0 items-start gap-2">
          <span className="shrink-0 pt-0.5 font-medium tabular-nums text-muted">#{index}</span>
          <div className="min-w-0 flex-1">
            {thumbnail}
            <p className="m-0 truncate text-[14px] leading-tight text-muted">{subtitle}</p>
          </div>
        </div>
      </TimelineBlock>
    </div>
  );
}
