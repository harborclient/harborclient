import type { WorkflowAction } from '@harborclient/core/types';
import type { WorkflowPanelPluginMode } from '@harborclient/sdk';
import type { OverlayScrollbarsComponentRef } from 'overlayscrollbars-react';
import type { JSX, PointerEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RootState } from '#/renderer/src/store/redux';
import { Scrollbars } from '#/renderer/src/ui/Shared/Scrollbars';
import { formatWorkflowDuration } from '#/renderer/src/workflows/formatWorkflowDuration';
import {
  layoutWorkflowTimeline,
  playbackIndexToTimelineMs,
  playheadXToActionIndex,
  timelineMsToPlayheadX
} from '#/renderer/src/workflows/timeline/workflowTimelineLayout';
import {
  clientXToTimelineContentX,
  timelinePanScrollLeft,
  timelinePointerExceededDragThreshold
} from '#/renderer/src/workflows/timeline/workflowTimelinePointer';
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
 * Active horizontal pan gesture against the OverlayScrollbars viewport.
 */
interface PanGestureState {
  /**
   * Pointer id captured for this pan.
   */
  pointerId: number;

  /**
   * Client X at pointer down.
   */
  originClientX: number;

  /**
   * Viewport scrollLeft at pointer down.
   */
  startScrollLeft: number;

  /**
   * True once movement exceeds the drag threshold.
   */
  active: boolean;
}

/**
 * Active playhead scrub gesture.
 */
interface ScrubGestureState {
  /**
   * Pointer id captured for this scrub.
   */
  pointerId: number;
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
 * Supports horizontal drag-to-pan of the viewport and drag-to-scrub of the
 * playhead (idle only). Wheel / scrollbar scrolling is unchanged.
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
  const trackContentRef = useRef<HTMLDivElement>(null);
  const panGestureRef = useRef<PanGestureState | null>(null);
  const scrubGestureRef = useRef<ScrubGestureState | null>(null);
  const suppressBlockClickRef = useRef(false);
  const [isPanning, setIsPanning] = useState(false);
  const [scrubXPx, setScrubXPx] = useState<number | null>(null);

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
   * Playhead X within the scrollable track content (layout-derived).
   */
  const computedPlayheadXPx = useMemo(
    () => timelineMsToPlayheadX(layout, timelineMs),
    [layout, timelineMs]
  );

  /**
   * Rendered playhead X: scrub override while dragging, otherwise layout position.
   */
  const playheadXPx = scrubXPx ?? computedPlayheadXPx;

  /**
   * Keeps the playhead in view while recording or playing by adjusting the
   * OverlayScrollbars viewport scroll offset as the playhead and track grow.
   * Skipped while the user is panning so auto-follow does not fight the drag.
   */
  useEffect(() => {
    if (!playing || isPanning) {
      return;
    }
    const viewport = scrollbarsRef.current?.osInstance()?.elements().scrollOffsetElement;
    if (viewport == null) {
      return;
    }
    scrollViewportToPlayhead(viewport, playheadXPx);
  }, [isPanning, layout.totalWidthPx, playheadXPx, playing]);

  /**
   * Resolves the OverlayScrollbars viewport used for horizontal pan.
   *
   * @returns Scroll offset element, or null when unavailable.
   */
  const getViewport = useCallback((): HTMLElement | null => {
    return scrollbarsRef.current?.osInstance()?.elements().scrollOffsetElement ?? null;
  }, []);

  /**
   * Seeks to the action under a content X while scrubbing, if it changed.
   *
   * @param contentXPx - Playhead X within the track content.
   */
  const seekFromContentX = useCallback(
    (contentXPx: number): void => {
      const index = playheadXToActionIndex(layout, contentXPx);
      if (index == null || index === selectedIndex) {
        return;
      }
      onSeek(index);
    },
    [layout, onSeek, selectedIndex]
  );

  /**
   * Begins a horizontal pan from pointer down on the timeline pan surface.
   * Uses document listeners so movement over child blocks still pans, and
   * defers capture until the drag threshold so clicks still seek.
   *
   * @param event - Pointer down on the pan surface.
   */
  const handlePanPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>): void => {
      if (event.button !== 0) {
        return;
      }
      if (scrubGestureRef.current != null) {
        return;
      }
      const viewport = getViewport();
      if (viewport == null) {
        return;
      }
      const panSurface = event.currentTarget;
      const pointerId = event.pointerId;
      const originClientX = event.clientX;
      const startScrollLeft = viewport.scrollLeft;
      const gesture: PanGestureState = {
        pointerId,
        originClientX,
        startScrollLeft,
        active: false
      };
      panGestureRef.current = gesture;

      /**
       * Advances the pan while the pointer moves; commits after the threshold.
       *
       * @param moveEvent - Document pointermove event.
       */
      const onMove = (moveEvent: globalThis.PointerEvent): void => {
        if (moveEvent.pointerId !== pointerId) {
          return;
        }
        const pan = panGestureRef.current;
        if (pan == null || pan.pointerId !== pointerId) {
          return;
        }
        if (!pan.active) {
          if (!timelinePointerExceededDragThreshold(pan.originClientX, moveEvent.clientX)) {
            return;
          }
          pan.active = true;
          setIsPanning(true);
          panSurface.setPointerCapture(pointerId);
        }
        const liveViewport = getViewport();
        if (liveViewport == null) {
          return;
        }
        liveViewport.scrollLeft = timelinePanScrollLeft(
          pan.startScrollLeft,
          pan.originClientX,
          moveEvent.clientX
        );
      };

      /**
       * Ends the pan gesture and tears down document listeners.
       *
       * @param upEvent - Document pointerup/cancel event.
       */
      const onUp = (upEvent: globalThis.PointerEvent): void => {
        if (upEvent.pointerId !== pointerId) {
          return;
        }
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onUp);
        const pan = panGestureRef.current;
        if (pan == null || pan.pointerId !== pointerId) {
          return;
        }
        panGestureRef.current = null;
        if (panSurface.hasPointerCapture(pointerId)) {
          panSurface.releasePointerCapture(pointerId);
        }
        if (pan.active) {
          suppressBlockClickRef.current = true;
          setIsPanning(false);
        }
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
    },
    [getViewport]
  );

  /**
   * Begins scrubbing the playhead; stops propagation so pan does not start.
   *
   * @param event - Pointer down on the playhead.
   */
  const handlePlayheadPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>): void => {
      if (playing || event.button !== 0) {
        return;
      }
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      scrubGestureRef.current = { pointerId: event.pointerId };
      const track = trackContentRef.current;
      if (track == null) {
        return;
      }
      const contentX = clientXToTimelineContentX(event.clientX, track, layout.totalWidthPx);
      setScrubXPx(contentX);
      seekFromContentX(contentX);
    },
    [layout.totalWidthPx, playing, seekFromContentX]
  );

  /**
   * Updates the scrubbed playhead X and seeks when the under-pointer action changes.
   *
   * @param event - Pointer move while scrubbing.
   */
  const handlePlayheadPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>): void => {
      const scrub = scrubGestureRef.current;
      if (scrub == null || scrub.pointerId !== event.pointerId) {
        return;
      }
      const track = trackContentRef.current;
      if (track == null) {
        return;
      }
      const contentX = clientXToTimelineContentX(event.clientX, track, layout.totalWidthPx);
      setScrubXPx(contentX);
      seekFromContentX(contentX);
    },
    [layout.totalWidthPx, seekFromContentX]
  );

  /**
   * Ends playhead scrubbing and clears the visual override.
   *
   * @param event - Pointer up/cancel on the playhead.
   */
  const handlePlayheadPointerUp = useCallback((event: PointerEvent<HTMLDivElement>): void => {
    const scrub = scrubGestureRef.current;
    if (scrub == null || scrub.pointerId !== event.pointerId) {
      return;
    }
    scrubGestureRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setScrubXPx(null);
  }, []);

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
          className={[
            'p-4! touch-none select-none',
            isPanning ? 'cursor-grabbing' : 'cursor-grab'
          ].join(' ')}
          style={{
            paddingTop: TIMELINE_PLAYHEAD_OVERHANG_PX,
            paddingBottom: TIMELINE_PLAYHEAD_OVERHANG_PX
          }}
          onPointerDown={handlePanPointerDown}
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
            trackContentRef={trackContentRef}
            suppressBlockClickRef={suppressBlockClickRef}
            onPlayheadPointerDown={handlePlayheadPointerDown}
            onPlayheadPointerMove={handlePlayheadPointerMove}
            onPlayheadPointerUp={handlePlayheadPointerUp}
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
