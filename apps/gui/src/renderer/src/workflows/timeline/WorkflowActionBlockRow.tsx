import type { WorkflowAction, WorkflowRunActionResult } from '@harborclient/core/types';
import type { JSX } from 'react';
import type { RootState } from '#/renderer/src/store/redux';
import { describeWorkflowAction } from '#/renderer/src/workflows/timeline/workflowThumbnails';
import { getWorkflowRegistryEntry } from '#/renderer/src/workflows/workflowRegistry';

interface Props {
  /**
   * Workflow action to render via the registry thumbnail.
   */
  action: WorkflowAction;

  /**
   * True when this block is selected / focused.
   */
  selected: boolean;

  /**
   * When true, thumbnails hide secondary text and status metrics.
   */
  compact: boolean;

  /**
   * Optional Redux getter for thumbnail name resolution.
   */
  getState?: () => RootState;

  /**
   * Optional run-log result for this step (send snapshots include status metrics).
   */
  result?: WorkflowRunActionResult;

  /**
   * When true, shows a 1-based `#N` index column (Results).
   */
  showIndex?: boolean;

  /**
   * 1-based execution order index; required when {@link showIndex} is true.
   */
  index?: number;

  /**
   * When true, shows the ran-at · durationMs subtitle (Results).
   */
  showTiming?: boolean;

  /**
   * ISO-8601 timestamp when this step started; used when {@link showTiming} is true.
   */
  ranAt?: string;

  /**
   * Wall-clock step duration in milliseconds; used when {@link showTiming} is true.
   */
  durationMs?: number;
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
 * Shared action-row content for footer timeline blocks and Results rows.
 *
 * Renders the registry thumbnail (including send status metrics when a run-log
 * result is provided). Results can optionally show `#N` and a timing subtitle;
 * the footer timeline hides both.
 *
 * @param props - Action, selection, density, optional result, and chrome flags.
 * @returns Inner row content (not the surrounding {@link TimelineBlock} chrome).
 */
export function WorkflowActionBlockRow({
  action,
  selected,
  compact,
  getState,
  result,
  showIndex = false,
  index,
  showTiming = false,
  ranAt,
  durationMs
}: Props): JSX.Element {
  const entry = getWorkflowRegistryEntry(action.type);
  const described = describeWorkflowAction(action, {
    selected,
    compact,
    getState,
    result
  });
  const thumbnail = entry?.thumbnail(action, {
    selected,
    compact,
    getState,
    result
  }) ?? <span className="truncate">{described.title}</span>;

  const timingSubtitle =
    showTiming && ranAt != null && durationMs != null
      ? `${formatStepRanAt(ranAt)} · ${durationMs} ms`
      : null;

  const body = (
    <div className={showIndex || timingSubtitle != null ? 'min-w-0 flex-1' : 'min-w-0 w-full'}>
      {thumbnail}
      {timingSubtitle != null ? (
        <p className="m-0 truncate text-[14px] leading-tight text-muted">{timingSubtitle}</p>
      ) : null}
    </div>
  );

  if (!showIndex) {
    return body;
  }

  return (
    <div className="flex w-full min-w-0 items-start gap-2">
      <span className="shrink-0 pt-0.5 font-medium tabular-nums text-muted">#{index ?? 0}</span>
      {body}
    </div>
  );
}
