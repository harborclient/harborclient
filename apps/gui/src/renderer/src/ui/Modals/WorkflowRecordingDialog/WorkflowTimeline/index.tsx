import type { WorkflowAction } from '@harborclient/core/types';
import type { JSX } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { RootState } from '#/renderer/src/store/redux';
import { formatWorkflowDuration } from '#/renderer/src/workflows/formatWorkflowDuration';
import {
  layoutWorkflowTimeline,
  playbackIndexToTimelineMs,
  timelineMsToPlayheadX
} from '#/renderer/src/workflows/timeline/workflowTimelineLayout';
import { describeWorkflowAction } from '#/renderer/src/workflows/timeline/workflowThumbnails';
import { TIMELINE_PLAYHEAD_EDGE_PAD_PX, TIMELINE_PLAYHEAD_OVERHANG_PX } from './TimelinePlayhead';
import { TimelineRuler } from './TimelineRuler';
import { TimelineTrack } from './TimelineTrack';

interface Props {
  /**
   * Database id of the workflow open in play/edit mode.
   */
  workflowId: number;

  /**
   * Loaded workflow actions.
   */
  actions: readonly WorkflowAction[];

  /**
   * Saved workflow duration in milliseconds.
   */
  durationMs: number;

  /**
   * Current playback cursor.
   */
  selectedIndex: number;

  /**
   * True while the play loop is running.
   */
  playing: boolean;

  /**
   * Optional Redux getter for thumbnail resolution.
   */
  getState?: () => RootState;

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
}

/**
 * Ruler, fixed-width track, and detail strip for workflow playback.
 *
 * @param props - Actions, duration, cursor, seek, and edit handlers.
 * @returns Timeline panel body.
 */
export function WorkflowTimeline({
  workflowId,
  actions,
  durationMs,
  selectedIndex,
  playing,
  getState,
  onSeek,
  onMoveAhead,
  onMoveBehind,
  onDelete,
  onEditPayload
}: Props): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [trackWidthPx, setTrackWidthPx] = useState(800);

  /**
   * Observes the track viewport width so proportional layout can fill the inner content
   * (viewport minus playhead edge padding) exactly.
   */
  useEffect(() => {
    const node = scrollRef.current;
    if (node == null || typeof ResizeObserver === 'undefined') {
      return;
    }
    /**
     * Converts a viewport width into the layout track width after edge padding.
     *
     * @param viewportWidthPx - Observed scroll viewport width in pixels.
     * @returns Width available for ruler and track content.
     */
    const toTrackWidthPx = (viewportWidthPx: number): number =>
      Math.max(200, Math.floor(viewportWidthPx) - TIMELINE_PLAYHEAD_EDGE_PAD_PX * 2);

    /**
     * Updates track width from the observed content box.
     *
     * @param entries - Resize observer entries.
     */
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry == null) {
        return;
      }
      setTrackWidthPx(toTrackWidthPx(entry.contentRect.width));
    });
    observer.observe(node);
    setTrackWidthPx(toTrackWidthPx(node.clientWidth));
    return () => {
      observer.disconnect();
    };
  }, []);

  /**
   * Lays out segments for the current actions and viewport width.
   */
  const layout = useMemo(
    () => layoutWorkflowTimeline(actions, durationMs, trackWidthPx),
    [actions, durationMs, trackWidthPx]
  );

  /**
   * Recorded timeline offset for the current cursor (playhead).
   */
  const timelineMs = useMemo(
    () => playbackIndexToTimelineMs(actions, durationMs, selectedIndex),
    [actions, durationMs, selectedIndex]
  );

  /**
   * Playhead X within the fixed-width track content.
   */
  const playheadXPx = useMemo(
    () => timelineMsToPlayheadX(layout, timelineMs),
    [layout, timelineMs]
  );

  const selectedAction =
    selectedIndex >= 0 && selectedIndex < actions.length ? actions[selectedIndex] : null;
  const described =
    selectedAction != null
      ? describeWorkflowAction(selectedAction, {
          selected: true,
          compact: false,
          getState
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
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-x-hidden overflow-y-hidden">
        <div
          style={{
            paddingLeft: TIMELINE_PLAYHEAD_EDGE_PAD_PX,
            paddingRight: TIMELINE_PLAYHEAD_EDGE_PAD_PX,
            paddingTop: TIMELINE_PLAYHEAD_OVERHANG_PX,
            paddingBottom: TIMELINE_PLAYHEAD_OVERHANG_PX
          }}
        >
          <TimelineRuler
            totalDurationMs={layout.totalDurationMs}
            totalWidthPx={layout.totalWidthPx}
          />
          <TimelineTrack
            workflowId={workflowId}
            actions={actions}
            layout={layout}
            selectedIndex={selectedIndex}
            playheadXPx={playheadXPx}
            playing={playing}
            getState={getState}
            onSeek={onSeek}
            onMoveAhead={onMoveAhead}
            onMoveBehind={onMoveBehind}
            onDelete={onDelete}
            onEditPayload={onEditPayload}
          />
        </div>
      </div>
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
