import type { WorkflowAction } from '@harborclient/core/types';
import type { WorkflowPanelPluginMode } from '@harborclient/sdk';
import type { OverlayScrollbarsComponentRef } from 'overlayscrollbars-react';
import type { JSX } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import type { RootState } from '#/renderer/src/store/redux';
import { Scrollbars } from '#/renderer/src/ui/Shared/Scrollbars';
import { formatWorkflowDuration } from '#/renderer/src/workflows/formatWorkflowDuration';
import {
  layoutWorkflowTimeline,
  playbackIndexToTimelineMs,
  timelineMsToPlayheadX
} from '#/renderer/src/workflows/timeline/workflowTimelineLayout';
import { describeWorkflowAction } from '#/renderer/src/workflows/timeline/workflowThumbnails';
import { TIMELINE_PLAYHEAD_EDGE_PAD_PX, TIMELINE_PLAYHEAD_OVERHANG_PX } from './TimelinePlayhead';
import { TimelineRuler } from './TimelineRuler';
import { TimelineTrack, type WorkflowTimelineRunLogByUuid } from './TimelineTrack';

interface Props {
  /**
   * Database id of the workflow open in play/edit mode, or `-1` while recording.
   */
  workflowId: number;

  /**
   * Active workflow footer panel mode for plugin surfaces.
   */
  mode: WorkflowPanelPluginMode;

  /**
   * Loaded workflow actions.
   */
  actions: readonly WorkflowAction[];

  /**
   * Saved or live session duration in milliseconds.
   */
  durationMs: number;

  /**
   * Current playback cursor.
   */
  selectedIndex: number;

  /**
   * Optional recorded timeline offset for the playhead in milliseconds.
   * When omitted, the playhead is derived from {@link selectedIndex}.
   */
  playheadMs?: number;

  /**
   * True while the play loop is running or recording is active.
   */
  playing: boolean;

  /**
   * When true, context-menu edits and payload double-click are enabled.
   */
  editable: boolean;

  /**
   * Optional Redux getter for thumbnail resolution.
   */
  getState?: () => RootState;

  /**
   * Optional run-log results keyed by action uuid (play mode).
   */
  runLogByActionUuid?: WorkflowTimelineRunLogByUuid;

  /**
   * Seeks to an action without dispatching.
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
   * When true, timeline blocks use the fixed gapless width.
   * When false, widths scale with recorded segment durations.
   */
  gapless?: boolean;

  /**
   * Playback delay in milliseconds; scales the visual gap between timeline blocks.
   */
  delayMs?: number;
}

/**
 * Scrolls the OverlayScrollbars viewport so `playheadXPx` stays within horizontal
 * edge padding. Prefer following forward growth during record/playback.
 *
 * @param viewport - OverlayScrollbars scroll offset element.
 * @param playheadXPx - Playhead X within the track content.
 */
function scrollViewportToPlayhead(viewport: HTMLElement, playheadXPx: number): void {
  const pad = TIMELINE_PLAYHEAD_EDGE_PAD_PX;
  const { clientWidth, scrollLeft } = viewport;
  if (clientWidth <= 0) {
    return;
  }
  const minVisible = scrollLeft + pad;
  const maxVisible = scrollLeft + clientWidth - pad;
  if (playheadXPx > maxVisible) {
    viewport.scrollLeft = Math.max(0, playheadXPx - clientWidth + pad);
  } else if (playheadXPx < minVisible) {
    viewport.scrollLeft = Math.max(0, playheadXPx - pad);
  }
}

/**
 * Ruler, scrollable track, and detail strip for the workflow footer timeline.
 *
 * @param props - Actions, duration, cursor, seek, and edit handlers.
 * @returns Timeline panel body.
 */
export function WorkflowTimeline({
  workflowId,
  mode,
  actions,
  durationMs,
  selectedIndex,
  playheadMs,
  playing,
  editable,
  getState,
  runLogByActionUuid,
  onSeek,
  onMoveAhead,
  onMoveBehind,
  onDelete,
  onEditPayload,
  gapless = false,
  delayMs = 0
}: Props): JSX.Element {
  const scrollbarsRef = useRef<OverlayScrollbarsComponentRef>(null);

  /**
   * Scrolls the selected timeline block into view when the cursor changes while
   * idle so keyboard navigation keeps the active step visible without fighting
   * continuous playhead following during record/playback.
   */
  useEffect(() => {
    if (playing) {
      return;
    }
    if (selectedIndex < 0 || selectedIndex >= actions.length) {
      return;
    }
    const node = document.getElementById(`workflow-timeline-block-${selectedIndex}`);
    node?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [actions.length, playing, selectedIndex]);

  /**
   * Lays out segments for the current actions, gapless mode, and playback delay
   * (which sizes the inter-block gap). Content width is absolute and may overflow.
   */
  const layout = useMemo(
    () => layoutWorkflowTimeline(actions, durationMs, gapless, delayMs),
    [actions, delayMs, durationMs, gapless]
  );

  /**
   * Recorded timeline offset for the current cursor (playhead).
   * Prefers an explicit continuous offset when the parent supplies one.
   */
  const timelineMs = useMemo(
    () =>
      playheadMs != null
        ? playheadMs
        : playbackIndexToTimelineMs(actions, durationMs, selectedIndex),
    [actions, durationMs, playheadMs, selectedIndex]
  );

  /**
   * Playhead X within the scrollable track content.
   */
  const playheadXPx = useMemo(
    () => timelineMsToPlayheadX(layout, timelineMs),
    [layout, timelineMs]
  );

  /**
   * Keeps the playhead in view while recording or playing by adjusting the
   * OverlayScrollbars viewport scroll offset as the playhead and track grow.
   */
  useEffect(() => {
    if (!playing) {
      return;
    }
    const viewport = scrollbarsRef.current?.osInstance()?.elements().scrollOffsetElement;
    if (viewport == null) {
      return;
    }
    scrollViewportToPlayhead(viewport, playheadXPx);
  }, [layout.totalWidthPx, playheadXPx, playing]);

  const selectedAction =
    selectedIndex >= 0 && selectedIndex < actions.length ? actions[selectedIndex] : null;
  const selectedResult =
    selectedAction != null ? runLogByActionUuid?.get(selectedAction.uuid)?.result : undefined;
  const described =
    selectedAction != null
      ? describeWorkflowAction(selectedAction, {
          selected: true,
          compact: false,
          getState,
          result: selectedResult
        })
      : selectedIndex >= actions.length && actions.length > 0
        ? { title: 'End of workflow' }
        : { title: 'No actions' };

  const segment =
    selectedIndex >= 0 && selectedIndex < layout.segments.length
      ? layout.segments[selectedIndex]
      : null;
  const deltaLabel =
    segment != null ? ` · ${formatWorkflowDuration(segment.durationMs)} segment` : '';

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <Scrollbars
        ref={scrollbarsRef}
        axis="horizontal"
        className="min-h-0 min-w-0 flex-1 rounded-md border border-separator"
      >
        <div
          className="p-4!"
          style={{
            paddingTop: TIMELINE_PLAYHEAD_OVERHANG_PX,
            paddingBottom: TIMELINE_PLAYHEAD_OVERHANG_PX
          }}
        >
          <TimelineRuler layout={layout} />
          <TimelineTrack
            workflowId={workflowId}
            mode={mode}
            actions={actions}
            layout={layout}
            selectedIndex={selectedIndex}
            playheadXPx={playheadXPx}
            playing={playing}
            editable={editable}
            getState={getState}
            runLogByActionUuid={runLogByActionUuid}
            onSeek={onSeek}
            onMoveAhead={onMoveAhead}
            onMoveBehind={onMoveBehind}
            onDelete={onDelete}
            onEditPayload={onEditPayload}
          />
        </div>
      </Scrollbars>
      <p className="shrink-0 truncate text-[14px] text-muted" aria-live="polite">
        {actions.length === 0
          ? 'No actions'
          : `Step ${Math.min(selectedIndex + 1, actions.length)} of ${actions.length} · ${described.title}${
              described.subtitle != null ? ` · ${described.subtitle}` : ''
            }${deltaLabel}`}
      </p>
    </div>
  );
}
