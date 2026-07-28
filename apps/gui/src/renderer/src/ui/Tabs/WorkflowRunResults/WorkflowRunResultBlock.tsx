import type { WorkflowAction } from '@harborclient/core/types';
import type { JSX } from 'react';
import type { RootState } from '#/renderer/src/store/redux';
import { TimelineBlock } from '#/renderer/src/workflows/timeline/TimelineBlock';
import { describeWorkflowAction } from '#/renderer/src/workflows/timeline/workflowThumbnails';
import { getWorkflowRegistryEntry } from '#/renderer/src/workflows/workflowRegistry';

interface Props {
  /**
   * Optional DOM id for aria-activedescendant targeting.
   */
  id?: string;

  /**
   * Executed workflow action to render as a timeline block.
   */
  action: WorkflowAction;

  /**
   * True when this block is the focused/selected list item.
   */
  selected: boolean;

  /**
   * Redux getState used by registry thumbnails to resolve request/env names.
   */
  getState: () => RootState;

  /**
   * Opens the JSON detail modal for this executed action.
   */
  onOpen: () => void;
}

/**
 * Interactive timeline block for one executed workflow-run step.
 *
 * Reuses TimelineBlock + registry thumbnail chrome from the run dialog preview
 * so Results rows match the visual language of the workflow timeline. Height
 * follows content (`fitContent`) so vertical lists do not stretch rows.
 *
 * @param props - Action, selection, store accessor, and open handler.
 * @returns Full-width, content-sized timeline block option.
 */
export function WorkflowRunResultBlock({
  id,
  action,
  selected,
  getState,
  onOpen
}: Props): JSX.Element {
  const entry = getWorkflowRegistryEntry(action.type);
  const described = describeWorkflowAction(action, {
    selected,
    compact: false,
    getState
  });
  const label =
    described.subtitle != null && described.subtitle.length > 0
      ? `${described.title}, ${described.subtitle}`
      : described.title;

  return (
    <div className="w-full shrink-0">
      <TimelineBlock id={id} label={label} selected={selected} fillWidth fitContent onSeek={onOpen}>
        {entry?.thumbnail(action, {
          selected,
          compact: false,
          getState
        }) ?? <span className="truncate">{described.title}</span>}
      </TimelineBlock>
    </div>
  );
}
