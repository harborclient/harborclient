import type { WorkflowAction } from '@harborclient/core/types';
import type { JSX } from 'react';
import type { RootState } from '#/renderer/src/store/redux';
import { TimelineBlock } from '#/renderer/src/workflows/timeline/TimelineBlock';
import {
  WORKFLOW_TIMELINE_COMPACT_WIDTH_PX,
  type WorkflowTimelineLayout
} from '#/renderer/src/workflows/timeline/workflowTimelineLayout';
import { describeWorkflowAction } from '#/renderer/src/workflows/timeline/workflowThumbnails';
import { getWorkflowRegistryEntry } from '#/renderer/src/workflows/workflowRegistry';
import { TimelinePlayhead } from './TimelinePlayhead';

interface Props {
  /**
   * Loaded workflow actions in play order.
   */
  actions: readonly WorkflowAction[];

  /**
   * Layout geometry from {@link layoutWorkflowTimeline}.
   */
  layout: WorkflowTimelineLayout;

  /**
   * Current playback cursor (next action to play).
   */
  selectedIndex: number;

  /**
   * Playhead X within the track content.
   */
  playheadXPx: number;

  /**
   * When true, block seek is disabled.
   */
  playing: boolean;

  /**
   * Optional Redux getter for thumbnail name resolution.
   */
  getState?: () => RootState;

  /**
   * Seeks to an action index without dispatching.
   *
   * @param index - Target action index.
   */
  onSeek: (index: number) => void;
}

/**
 * Fixed-width row of timeline blocks with a vertical playhead.
 *
 * @param props - Actions, layout, selection, and seek handler.
 * @returns Track listbox of seekable blocks.
 */
export function TimelineTrack({
  actions,
  layout,
  selectedIndex,
  playheadXPx,
  playing,
  getState,
  onSeek
}: Props): JSX.Element {
  return (
    <div
      className="relative flex min-h-[64px] items-stretch"
      style={{ width: layout.totalWidthPx }}
      role="listbox"
      aria-label="Workflow actions"
      aria-activedescendant={
        selectedIndex >= 0 && selectedIndex < actions.length
          ? `workflow-timeline-block-${selectedIndex}`
          : undefined
      }
    >
      <TimelinePlayhead xPx={playheadXPx} />
      {layout.segments.map((segment) => {
        const action = actions[segment.index];
        if (action == null) {
          return null;
        }
        const compact = segment.widthPx <= WORKFLOW_TIMELINE_COMPACT_WIDTH_PX;
        const entry = getWorkflowRegistryEntry(action.type);
        const described = describeWorkflowAction(action, {
          selected: segment.index === selectedIndex,
          compact,
          getState
        });
        const label =
          described.subtitle != null && described.subtitle.length > 0
            ? `${described.title}, ${described.subtitle}`
            : described.title;

        return (
          <TimelineBlock
            key={`${segment.index}-${action.type}`}
            id={`workflow-timeline-block-${segment.index}`}
            label={label}
            selected={segment.index === selectedIndex}
            widthPx={segment.widthPx}
            disabled={playing}
            onSeek={() => {
              onSeek(segment.index);
            }}
          >
            {entry?.thumbnail(action, {
              selected: segment.index === selectedIndex,
              compact,
              getState
            }) ?? <span className="truncate">{described.title}</span>}
          </TimelineBlock>
        );
      })}
    </div>
  );
}
