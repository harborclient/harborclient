import type { WorkflowAction } from '@harborclient/core/types';
import type { WorkflowActionBlockContext } from '@harborclient/sdk';
import type { JSX, MouseEvent } from 'react';
import { useCallback, useState } from 'react';
import type { RootState } from '#/renderer/src/store/redux';
import { HostedSurface } from '#/renderer/src/plugins/HostedSurface';
import { usePluginWorkflowActionBlocks } from '#/renderer/src/plugins/pluginHooks';
import { TimelineBlock } from '#/renderer/src/workflows/timeline/TimelineBlock';
import {
  WORKFLOW_TIMELINE_COMPACT_WIDTH_PX,
  type WorkflowTimelineLayout
} from '#/renderer/src/workflows/timeline/workflowTimelineLayout';
import { describeWorkflowAction } from '#/renderer/src/workflows/timeline/workflowThumbnails';
import { getWorkflowRegistryEntry } from '#/renderer/src/workflows/workflowRegistry';
import { TimelinePlayhead } from './TimelinePlayhead';
import { WorkflowTimelineActionMenu } from './WorkflowTimelineActionMenu';

interface Props {
  /**
   * Database id of the workflow open in play/edit mode.
   */
  workflowId: number;

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
   * When true, block seek and edits are disabled.
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

  /**
   * Moves the action at the given index one step earlier.
   *
   * @param index - Action index to move.
   */
  onMoveAhead: (index: number) => void;

  /**
   * Moves the action at the given index one step later.
   *
   * @param index - Action index to move.
   */
  onMoveBehind: (index: number) => void;

  /**
   * Deletes the action at the given index after confirmation.
   *
   * @param index - Action index to delete.
   */
  onDelete: (index: number) => void;

  /**
   * Opens the JSON payload editor for the action at the given index.
   *
   * @param index - Action index to edit.
   */
  onEditPayload: (index: number) => void;
}

/**
 * Open context-menu state for a timeline action block.
 */
interface ContextMenuState {
  /**
   * Action index the menu targets.
   */
  index: number;

  /**
   * Viewport X for the menu anchor.
   */
  x: number;

  /**
   * Viewport Y for the menu anchor.
   */
  y: number;
}

/**
 * Fixed-width row of timeline blocks with a vertical playhead and action context menu.
 *
 * @param props - Actions, layout, selection, seek, and edit handlers.
 * @returns Track listbox of seekable blocks.
 */
export function TimelineTrack({
  workflowId,
  actions,
  layout,
  selectedIndex,
  playheadXPx,
  playing,
  getState,
  onSeek,
  onMoveAhead,
  onMoveBehind,
  onDelete,
  onEditPayload
}: Props): JSX.Element {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const actionBlocks = usePluginWorkflowActionBlocks();

  /**
   * Opens the action context menu after seeking to the right-clicked block.
   *
   * @param index - Action index under the pointer.
   * @param event - Context menu mouse event.
   */
  const handleBlockContextMenu = useCallback(
    (index: number, event: MouseEvent<HTMLDivElement>): void => {
      if (playing) {
        return;
      }
      onSeek(index);
      setContextMenu({ index, x: event.clientX, y: event.clientY });
    },
    [onSeek, playing]
  );

  /**
   * Seeks to the block and opens the payload editor when playback is idle.
   *
   * @param index - Action index to edit.
   */
  const handleEditPayload = useCallback(
    (index: number): void => {
      if (playing) {
        return;
      }
      onEditPayload(index);
    },
    [onEditPayload, playing]
  );

  /**
   * Closes the open context menu.
   */
  const handleCloseMenu = useCallback((): void => {
    setContextMenu(null);
  }, []);

  return (
    <>
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
          const matchingBlocks = compact
            ? []
            : actionBlocks.filter(
                (block) =>
                  !block.actionTypes ||
                  block.actionTypes.length === 0 ||
                  block.actionTypes.includes(action.type)
              );
          const blockContext: WorkflowActionBlockContext = {
            workflowId,
            actionIndex: segment.index,
            action: {
              type: action.type,
              ...(action.at != null ? { at: action.at } : {}),
              payload: action.payload
            },
            selected: segment.index === selectedIndex,
            compact
          };

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
              onEditPayload={() => {
                handleEditPayload(segment.index);
              }}
              onContextMenu={(event) => {
                handleBlockContextMenu(segment.index, event);
              }}
              pluginSurface={
                matchingBlocks.length > 0 ? (
                  <div className="flex h-full min-h-[28px] flex-col gap-0.5">
                    {matchingBlocks.map((block) => (
                      <HostedSurface
                        key={`${block.pluginId}:${block.contributionId}`}
                        pluginId={block.pluginId}
                        contributionId={block.contributionId}
                        kind="workflowActionBlocks"
                        context={blockContext}
                        className="min-h-[28px] flex-1"
                        resizeMode="fill"
                      />
                    ))}
                  </div>
                ) : undefined
              }
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
      {contextMenu != null ? (
        <WorkflowTimelineActionMenu
          actionIndex={contextMenu.index}
          actionCount={actions.length}
          playing={playing}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onMoveAhead={() => {
            onMoveAhead(contextMenu.index);
          }}
          onMoveBehind={() => {
            onMoveBehind(contextMenu.index);
          }}
          onEditPayload={() => {
            handleEditPayload(contextMenu.index);
          }}
          onDelete={() => {
            onDelete(contextMenu.index);
          }}
          onClose={handleCloseMenu}
        />
      ) : null}
    </>
  );
}
