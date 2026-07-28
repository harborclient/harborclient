import type { WorkflowAction } from '@harborclient/core/types';
import type { JSX } from 'react';
import type { RootState } from '#/renderer/src/store/redux';
import { TimelineBlock } from '#/renderer/src/workflows/timeline/TimelineBlock';
import { describeWorkflowAction } from '#/renderer/src/workflows/timeline/workflowThumbnails';
import { getWorkflowRegistryEntry } from '#/renderer/src/workflows/workflowRegistry';

interface Props {
  /**
   * Action to preview: the playback cursor step in run mode, or the last recorded
   * session event in record mode. Null when there are no actions.
   */
  action: WorkflowAction | null;

  /**
   * Redux getState used by registry thumbnails to resolve request/env names.
   */
  getState: () => RootState;
}

/**
 * Non-interactive timeline block preview of a workflow action.
 *
 * Mirrors TimelineTrack chrome (TimelineBlock + registry thumbnail) so the compact
 * run and record dialogs show the same visual as the timeline editor. Used for the
 * active run step and the last recorded action. The block fills the dialog content
 * width; long labels truncate with ellipsis.
 *
 * @param props - Action to display and store accessor.
 * @returns Status region with a selected, disabled timeline block or empty placeholder.
 */
export function WorkflowRunActionPreview({ action, getState }: Props): JSX.Element {
  if (action == null) {
    return (
      <div className="w-full overflow-hidden" role="status" aria-live="polite">
        <p className="text-muted">No action</p>
      </div>
    );
  }

  const entry = getWorkflowRegistryEntry(action.type);
  const described = describeWorkflowAction(action, {
    selected: true,
    compact: false,
    getState
  });
  const label =
    described.subtitle != null && described.subtitle.length > 0
      ? `${described.title}, ${described.subtitle}`
      : described.title;

  /**
   * No-op seek handler; the preview is display-only.
   */
  const handleSeek = (): void => {};

  return (
    <div className="w-full overflow-hidden" role="status" aria-live="polite">
      <TimelineBlock label={label} selected disabled fillWidth onSeek={handleSeek}>
        {entry?.thumbnail(action, {
          selected: true,
          compact: false,
          getState
        }) ?? <span className="truncate">{described.title}</span>}
      </TimelineBlock>
    </div>
  );
}
