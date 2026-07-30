import type { WorkflowAction, WorkflowRunActionResult } from '@harborclient/core/types';
import type { WorkflowActionBlockContext, WorkflowPanelPluginMode } from '@harborclient/sdk';
import type { JSX, KeyboardEvent, MouseEvent, PointerEvent, Ref } from 'react';
import { useCallback, useState } from 'react';
import type { RootState } from '#/renderer/src/store/redux';
import { HostedSurface } from '#/renderer/src/plugins/HostedSurface';
import { usePluginWorkflowActionBlocks } from '#/renderer/src/plugins/pluginHooks';
import { TimelineBlock } from '#/renderer/src/workflows/timeline/TimelineBlock';
import { WorkflowActionBlockRow } from '#/renderer/src/workflows/timeline/WorkflowActionBlockRow';
import { workflowActionBlockPrimaryLabel } from '#/renderer/src/workflows/timeline/workflowActionBlockPrimaryLabel';
import { resolveWorkflowTimelineListboxKey } from '#/renderer/src/workflows/timeline/workflowTimelineListboxKeys';
import {
  WORKFLOW_TIMELINE_COMPACT_WIDTH_PX,
  type WorkflowTimelineLayout
} from '#/renderer/src/workflows/timeline/workflowTimelineLayout';
import { TimelinePlayhead } from './TimelinePlayhead';
import { WorkflowTimelineActionMenu } from './WorkflowTimelineActionMenu';

/**
 * Run-log fields keyed by action uuid for footer timeline enrichment.
 */
export type WorkflowTimelineRunLogByUuid = ReadonlyMap<
  string,
  {
    result: WorkflowRunActionResult;
  }
>;

interface Props {
  /**
   * Database id of the workflow open in play/edit mode, or `-1` while recording.
   */
  workflowId: number;

  /**
   * Active workflow footer panel mode for plugin action-block contexts.
   */
  mode: WorkflowPanelPluginMode;

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
   * When true, context-menu edits and payload double-click are enabled (edit / paused record).
   */
  editable: boolean;

  /**
   * Optional Redux getter for thumbnail name resolution.
   */
  getState?: () => RootState;

  /**
   * Optional run-log results keyed by action uuid (play mode after/during a run).
   */
  runLogByActionUuid?: WorkflowTimelineRunLogByUuid;

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

  /**
   * Ref to the track content element used for pointer → content X mapping.
   */
  trackContentRef?: Ref<HTMLDivElement>;

  /**
   * When true after a pan gesture, the next block click should not seek.
   */
  suppressBlockClickRef?: { current: boolean };

  /**
   * Begins a playhead scrub gesture.
   *
   * @param event - Pointer down on the playhead.
   */
  onPlayheadPointerDown: (event: PointerEvent<HTMLDivElement>) => void;

  /**
   * Updates scrub position while dragging the playhead.
   *
   * @param event - Pointer move while scrubbing.
   */
  onPlayheadPointerMove: (event: PointerEvent<HTMLDivElement>) => void;

  /**
   * Ends a playhead scrub gesture.
   *
   * @param event - Pointer up/cancel on the playhead.
   */
  onPlayheadPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
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
 * Builds a menu anchor near the center of a timeline block element.
 *
 * @param index - Action index whose block should anchor the menu.
 * @returns Viewport coordinates, or null when the block is missing.
 */
function menuPositionForBlock(index: number): { x: number; y: number } | null {
  const node = document.getElementById(`workflow-timeline-block-${index}`);
  if (node == null) {
    return null;
  }
  const rect = node.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.bottom
  };
}

/**
 * Fixed-width row of timeline blocks with a vertical playhead and action context menu.
 *
 * The playhead sits outside the listbox so its slider role is valid. The track is a
 * single-tab-stop listbox: arrow keys seek, and ContextMenu / Shift+F10 opens the
 * edit menu when editable. When editable, double-clicking a block opens the payload
 * editor. Options use `tabIndex={-1}` so focus stays on the listbox with
 * `aria-activedescendant`.
 *
 * @param props - Actions, layout, selection, seek, scrub, and edit handlers.
 * @returns Track listbox of seekable blocks plus an interactive playhead.
 */
export function TimelineTrack({
  workflowId,
  mode,
  actions,
  layout,
  selectedIndex,
  playheadXPx,
  playing,
  editable,
  getState,
  runLogByActionUuid,
  onSeek,
  onMoveAhead,
  onMoveBehind,
  onDelete,
  onEditPayload,
  trackContentRef,
  suppressBlockClickRef,
  onPlayheadPointerDown,
  onPlayheadPointerMove,
  onPlayheadPointerUp
}: Props): JSX.Element {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const actionBlocks = usePluginWorkflowActionBlocks();

  /**
   * Seeks to a block unless a preceding pan gesture asked to suppress the click.
   *
   * @param index - Action index to seek.
   */
  const handleBlockSeek = useCallback(
    (index: number): void => {
      if (suppressBlockClickRef?.current) {
        suppressBlockClickRef.current = false;
        return;
      }
      onSeek(index);
    },
    [onSeek, suppressBlockClickRef]
  );

  /**
   * Opens the action context menu after seeking to the right-clicked block.
   *
   * @param index - Action index under the pointer.
   * @param event - Context menu mouse event.
   */
  const handleBlockContextMenu = useCallback(
    (index: number, event: MouseEvent<HTMLDivElement>): void => {
      if (playing || !editable) {
        return;
      }
      onSeek(index);
      setContextMenu({ index, x: event.clientX, y: event.clientY });
    },
    [editable, onSeek, playing]
  );

  /**
   * Opens the action context menu anchored to the selected block (keyboard path).
   *
   * @param index - Action index to open the menu for.
   */
  const openMenuForIndex = useCallback(
    (index: number): void => {
      if (playing || !editable) {
        return;
      }
      onSeek(index);
      const position = menuPositionForBlock(index);
      if (position == null) {
        return;
      }
      setContextMenu({ index, x: position.x, y: position.y });
    },
    [editable, onSeek, playing]
  );

  /**
   * Seeks to the block and opens the payload editor when edits are allowed.
   *
   * @param index - Action index to edit.
   */
  const handleEditPayload = useCallback(
    (index: number): void => {
      if (playing || !editable) {
        return;
      }
      onEditPayload(index);
    },
    [editable, onEditPayload, playing]
  );

  /**
   * Closes the open context menu.
   */
  const handleCloseMenu = useCallback((): void => {
    setContextMenu(null);
  }, []);

  /**
   * Handles listbox keyboard navigation and keyboard context-menu open.
   *
   * @param event - Keyboard event from the listbox container.
   */
  const handleListboxKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>): void => {
      const action = resolveWorkflowTimelineListboxKey({
        key: event.key,
        shiftKey: event.shiftKey,
        selectedIndex,
        actionCount: actions.length,
        playing,
        editable
      });
      if (action == null) {
        return;
      }
      event.preventDefault();
      if (action.type === 'seek') {
        onSeek(action.index);
        return;
      }
      openMenuForIndex(selectedIndex >= 0 && selectedIndex < actions.length ? selectedIndex : 0);
    },
    [actions.length, editable, onSeek, openMenuForIndex, playing, selectedIndex]
  );

  return (
    <>
      <div ref={trackContentRef} className="relative" style={{ width: layout.totalWidthPx }}>
        <TimelinePlayhead
          xPx={playheadXPx}
          selectedIndex={selectedIndex}
          actionCount={actions.length}
          playing={playing}
          onSeek={onSeek}
          onScrubPointerDown={onPlayheadPointerDown}
          onScrubPointerMove={onPlayheadPointerMove}
          onScrubPointerUp={onPlayheadPointerUp}
        />
        <div
          className="relative flex min-h-[64px] items-stretch focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          style={{ width: layout.totalWidthPx, gap: layout.gapPx }}
          role="listbox"
          tabIndex={playing ? -1 : 0}
          aria-label="Workflow actions"
          aria-activedescendant={
            selectedIndex >= 0 && selectedIndex < actions.length
              ? `workflow-timeline-block-${selectedIndex}`
              : undefined
          }
          onKeyDown={handleListboxKeyDown}
        >
          {layout.segments.map((segment) => {
            const action = actions[segment.index];
            if (action == null) {
              return null;
            }
            const compact = segment.widthPx <= WORKFLOW_TIMELINE_COMPACT_WIDTH_PX;
            const runLogEntry = runLogByActionUuid?.get(action.uuid);
            const result = runLogEntry?.result;
            const label = workflowActionBlockPrimaryLabel(action, result, getState);
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
              mode,
              actionIndex: segment.index,
              action: {
                uuid: action.uuid,
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
                tabIndex={-1}
                onSeek={() => {
                  handleBlockSeek(segment.index);
                }}
                onEditPayload={
                  editable
                    ? () => {
                        handleEditPayload(segment.index);
                      }
                    : undefined
                }
                onContextMenu={
                  editable
                    ? (event) => {
                        handleBlockContextMenu(segment.index, event);
                      }
                    : undefined
                }
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
                <WorkflowActionBlockRow
                  action={action}
                  selected={segment.index === selectedIndex}
                  compact={compact}
                  getState={getState}
                  result={result}
                />
              </TimelineBlock>
            );
          })}
        </div>
      </div>
      {contextMenu != null && editable ? (
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
