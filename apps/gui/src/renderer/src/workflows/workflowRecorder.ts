import type { UnknownAction } from '@reduxjs/toolkit';
import type { WorkflowAction } from '@harborclient/core/types';
import type { AppDispatch, RootState } from '#/renderer/src/store/redux';
import {
  OPEN_WORKSPACE_FULFILLED_TYPE,
  OPEN_WORKSPACE_PENDING_TYPE,
  OPEN_WORKSPACE_REJECTED_TYPE
} from '#/renderer/src/store/thunks/openWorkspaceType';
import { WorkflowCoalescer } from './workflowCoalescer';
import { WorkflowEventSink } from './workflowEventSink';
import type { WorkflowEvent } from './workflowEventTypes';
import {
  captureWorkflowRecordCheckpoint,
  restoreWorkflowRecordCheckpoint,
  type WorkflowRecordCheckpoint
} from './workflowRecordCheckpoints';
import { WORKFLOW_REGISTRY_CORE } from './workflowRegistryCore';
import { buildWorkflowRegistryMap } from './utils';
import { resetTabCloseRecordingForTests } from './workflowTabCloseBridge';

type SessionListener = () => void;

/**
 * Redux access required to restore a recording checkpoint on seek.
 */
export interface WorkflowRecordSeekCtx {
  /**
   * App dispatch used to apply checkpoint restore actions.
   */
  dispatch: AppDispatch;
}

/**
 * Logical event types omitted while an atomic `workspace.open` is in flight.
 */
const WORKSPACE_FANOUT_SUPPRESSED_EVENT_TYPES = new Set(['request.load', 'environment.activate']);

/**
 * Devtools and UI surface for the current workflow recording session.
 */
export interface WorkflowLogApi {
  /**
   * Flushed events plus any coalesce buffer (flush-on-read for console inspection).
   */
  readonly events: WorkflowEvent[];

  /**
   * True while the session is actively appending Redux-derived events.
   */
  readonly isRecording: boolean;

  /**
   * Elapsed recording time in milliseconds (pauses while stopped).
   */
  readonly elapsedMs: number;

  /**
   * Clears the sink, coalesce buffer, and elapsed timer.
   */
  clear: () => void;

  /**
   * Flushes the coalesce buffer into the sink without clearing history.
   */
  flush: () => void;

  /**
   * Starts or resumes appending recorded actions.
   */
  start: () => void;

  /**
   * Stops appending; elapsed time pauses and existing actions are kept.
   */
  stop: () => void;

  /**
   * Subscribes to sink mutations after events are flushed.
   *
   * @param listener - Called with the current flushed event list.
   * @returns Unsubscribe function.
   */
  subscribe: (listener: (events: readonly WorkflowEvent[]) => void) => () => void;

  /**
   * Subscribes to recording / elapsed session changes.
   *
   * @param listener - Called when recording state or elapsed time changes.
   * @returns Unsubscribe function.
   */
  subscribeSession: (listener: SessionListener) => () => void;
}

const registryMap = buildWorkflowRegistryMap(WORKFLOW_REGISTRY_CORE);
const coalescer = new WorkflowCoalescer();
const sink = new WorkflowEventSink();
const sessionListeners = new Set<SessionListener>();

/**
 * Checkpoints aligned 1:1 with flushed sink events (state after each event).
 */
let checkpoints: WorkflowRecordCheckpoint[] = [];

/**
 * Checkpoint for the event currently held in the coalesce buffer, if any.
 */
let pendingCheckpoint: WorkflowRecordCheckpoint | null = null;

/**
 * Playhead index while paused (state after this action). Advanced to the tip
 * when events append during an active recording.
 */
let recordPlayheadIndex = -1;

let recording = false;
let recordingMuted = false;
let suppressWorkspaceFanOut = false;
let elapsedMs = 0;
let segmentStartedAt: number | null = null;

/**
 * Appends a flushed event and its matching checkpoint, syncing ring eviction.
 *
 * @param event - Event leaving the coalescer for the sink.
 * @param checkpoint - App-state snapshot taken when that event was accepted.
 */
function appendEventWithCheckpoint(
  event: WorkflowEvent,
  checkpoint: WorkflowRecordCheckpoint
): void {
  const dropped = sink.append(event);
  checkpoints.push(checkpoint);
  if (dropped > 0) {
    checkpoints = checkpoints.slice(dropped);
  }
  recordPlayheadIndex = checkpoints.length - 1;
}

/**
 * Notifies session listeners that recording or elapsed time changed.
 */
function notifySessionListeners(): void {
  for (const listener of sessionListeners) {
    listener();
  }
}

/**
 * Commits the open recording segment into {@link elapsedMs} when stopping.
 */
function commitOpenSegment(): void {
  if (segmentStartedAt == null) {
    return;
  }
  elapsedMs += Date.now() - segmentStartedAt;
  segmentStartedAt = null;
}

/**
 * Returns elapsed recording time, including any open segment.
 *
 * @returns Elapsed milliseconds.
 */
function getElapsedMs(): number {
  if (segmentStartedAt == null) {
    return elapsedMs;
  }
  return elapsedMs + (Date.now() - segmentStartedAt);
}

/**
 * Flushes the coalesce buffer into the sink when it holds an event.
 */
function flushBuffer(): void {
  const flushed = coalescer.flush();
  if (flushed != null && pendingCheckpoint != null) {
    appendEventWithCheckpoint(flushed, pendingCheckpoint);
  }
  pendingCheckpoint = null;
}

/**
 * Drops recorded actions after the current playhead so resume continues from that mark.
 *
 * No-op when the session is empty or the playhead is already at the tip. Sets
 * elapsed time from the kept tip checkpoint.
 */
function truncateSessionAfterPlayhead(): void {
  flushBuffer();
  const events = sink.getEvents();
  if (events.length === 0 || recordPlayheadIndex < 0) {
    return;
  }
  const clamped = Math.min(recordPlayheadIndex, events.length - 1);
  if (clamped >= events.length - 1) {
    return;
  }

  sink.truncateTo(clamped);
  checkpoints = checkpoints.slice(0, clamped + 1);
  recordPlayheadIndex = clamped;
  const tipCheckpoint = checkpoints[clamped];
  if (tipCheckpoint != null) {
    elapsedMs = tipCheckpoint.elapsedMs;
  }
  segmentStartedAt = null;
}

/**
 * Starts or resumes the recording session so Redux actions append to the log.
 *
 * When resuming with the playhead before the tip, truncates later actions first
 * so new recording replaces the discarded future.
 */
export function startRecording(): void {
  if (recording) {
    return;
  }
  truncateSessionAfterPlayhead();
  recording = true;
  segmentStartedAt = Date.now();
  notifySessionListeners();
}

/**
 * Stops appending actions; keeps the session buffer and pauses the timer.
 */
export function stopRecording(): void {
  if (!recording) {
    return;
  }
  flushBuffer();
  commitOpenSegment();
  recording = false;
  notifySessionListeners();
}

/**
 * Returns whether the session is currently recording.
 *
 * @returns True while appending is enabled.
 */
export function isRecording(): boolean {
  return recording;
}

/**
 * Returns elapsed recording time for the current session.
 *
 * @returns Elapsed milliseconds including any open segment.
 */
export function getRecordingElapsedMs(): number {
  return getElapsedMs();
}

/**
 * Returns flushed session events, promoting any coalesce buffer first.
 *
 * @returns Current session events.
 */
export function getSessionEvents(): WorkflowEvent[] {
  flushBuffer();
  return sink.getEvents();
}

/**
 * Clears session events, coalesce buffer, checkpoints, and elapsed timer.
 */
export function clearSession(): void {
  coalescer.flush();
  pendingCheckpoint = null;
  checkpoints = [];
  recordPlayheadIndex = -1;
  sink.clear();
  recording = false;
  elapsedMs = 0;
  segmentStartedAt = null;
  notifySessionListeners();
}

/**
 * Returns the paused recording playhead index (state after this action).
 *
 * @returns Playhead index, or `-1` when the session has no events.
 */
export function getRecordPlayheadIndex(): number {
  return recordPlayheadIndex;
}

/**
 * While paused, restores app state after the selected action without dropping
 * later blocks so the user can scrub history freely. Resume truncates via
 * {@link startRecording}.
 *
 * Selecting index `i` means “state after action `i`.” Seek while recording is a
 * no-op. Session elapsed time is left unchanged so the timeline keeps later blocks.
 *
 * @param index - Target action index (clamped to the current session).
 * @param ctx - Dispatch used to apply the checkpoint.
 * @returns Clamped playhead index after seek, or `-1` when the session is empty.
 */
export function seekRecordingTo(index: number, ctx: WorkflowRecordSeekCtx): number {
  if (recording) {
    const events = sink.getEvents();
    return events.length === 0 ? -1 : events.length - 1;
  }

  flushBuffer();
  const events = sink.getEvents();
  if (events.length === 0) {
    recordPlayheadIndex = -1;
    return -1;
  }

  const clamped = Math.min(Math.max(0, Math.floor(index)), events.length - 1);
  const checkpoint = checkpoints[clamped];
  if (checkpoint == null) {
    recordPlayheadIndex = clamped;
    return clamped;
  }

  if (clamped === recordPlayheadIndex) {
    return clamped;
  }

  setWorkflowRecordingMuted(true);
  try {
    restoreWorkflowRecordCheckpoint(checkpoint, ctx.dispatch);
    recordPlayheadIndex = clamped;
  } finally {
    setWorkflowRecordingMuted(false);
  }

  notifySessionListeners();
  return clamped;
}

/**
 * Rebuilds checkpoints after a session edit, preserving an intact uuid prefix.
 *
 * Actions after the first order/identity change receive a fresh capture of the
 * current app state (accurate at the tip; historical mid-suffix seek is best-effort).
 *
 * @param previousEvents - Events before the edit.
 * @param previousCheckpoints - Checkpoints aligned with {@link previousEvents}.
 * @param nextEvents - Events after the edit.
 * @param getState - Current Redux state for suffix captures.
 * @param elapsedMsNow - Elapsed time stamped onto suffix checkpoints.
 * @returns Checkpoints aligned 1:1 with {@link nextEvents}.
 */
function rebuildCheckpointsAfterReplace(
  previousEvents: readonly WorkflowEvent[],
  previousCheckpoints: readonly WorkflowRecordCheckpoint[],
  nextEvents: readonly WorkflowEvent[],
  getState: () => RootState,
  elapsedMsNow: number
): WorkflowRecordCheckpoint[] {
  const rebuilt: WorkflowRecordCheckpoint[] = [];
  let prefixIntact = true;
  for (let i = 0; i < nextEvents.length; i += 1) {
    const next = nextEvents[i]!;
    const prev = previousEvents[i];
    if (prefixIntact && prev?.uuid === next.uuid && previousCheckpoints[i] != null) {
      rebuilt.push(previousCheckpoints[i]!);
      continue;
    }
    prefixIntact = false;
    rebuilt.push(captureWorkflowRecordCheckpoint(getState(), elapsedMsNow));
  }
  return rebuilt;
}

/**
 * Replaces the paused recording session actions (reorder, delete, payload edit).
 *
 * No-op while actively recording. Flushes the coalesce buffer first, then swaps
 * the sink contents and rebuilds checkpoints from an intact uuid prefix.
 *
 * @param nextActions - Updated ordered actions for the session.
 * @param getState - Redux getter used when capturing suffix checkpoints.
 * @param playheadIndex - Optional playhead after the edit; defaults to clamping
 *   the current playhead into the new list.
 */
export function replaceSessionActions(
  nextActions: readonly WorkflowAction[],
  getState: () => RootState,
  playheadIndex?: number
): void {
  if (recording) {
    return;
  }

  flushBuffer();
  const previousEvents = sink.getEvents();
  const previousCheckpoints = checkpoints;
  const nextEvents: WorkflowEvent[] = nextActions.map((action) => ({
    uuid: action.uuid,
    type: action.type,
    at: action.at ?? Date.now(),
    payload: action.payload
  }));

  sink.replaceAll(nextEvents);
  const retained = sink.getEvents();
  checkpoints = rebuildCheckpointsAfterReplace(
    previousEvents,
    previousCheckpoints,
    retained,
    getState,
    getElapsedMs()
  );
  pendingCheckpoint = null;
  if (retained.length === 0) {
    recordPlayheadIndex = -1;
  } else if (playheadIndex != null) {
    recordPlayheadIndex = Math.min(Math.max(0, Math.floor(playheadIndex)), retained.length - 1);
  } else {
    recordPlayheadIndex = Math.min(Math.max(0, recordPlayheadIndex), retained.length - 1);
  }
  notifySessionListeners();
}

/**
 * Subscribes to recording / elapsed session changes.
 *
 * @param listener - Called when session state changes.
 * @returns Unsubscribe function.
 */
export function subscribeRecordingSession(listener: SessionListener): () => void {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

/**
 * Mutes recording so playback (and mid-pause UI) does not append workflow events.
 *
 * @param muted - True to ignore Redux actions even while recording is active.
 */
export function setWorkflowRecordingMuted(muted: boolean): void {
  recordingMuted = muted;
}

/**
 * Returns whether recording is muted by an active playback session.
 *
 * @returns True when Redux actions are ignored for recording.
 */
export function isWorkflowRecordingMuted(): boolean {
  return recordingMuted;
}

/**
 * Returns whether nested workspace fan-out events are currently suppressed.
 *
 * @returns True between `workspaces/open/pending` and fulfilled/rejected.
 */
export function isWorkspaceFanOutSuppressed(): boolean {
  return suppressWorkspaceFanOut;
}

/**
 * Updates the workspace-open fan-out suppress flag from lifecycle actions.
 *
 * @param action - Dispatched Redux action.
 */
function updateWorkspaceFanOutSuppress(action: UnknownAction): void {
  if (action.type === OPEN_WORKSPACE_PENDING_TYPE) {
    suppressWorkspaceFanOut = true;
    return;
  }
  if (
    action.type === OPEN_WORKSPACE_FULFILLED_TYPE ||
    action.type === OPEN_WORKSPACE_REJECTED_TYPE
  ) {
    suppressWorkspaceFanOut = false;
  }
}

/**
 * Processes a Redux action through the workflow registry and coalescer.
 *
 * Actions are ignored while the session is stopped or muted for playback.
 * Matching actions are normalized, coalesced when consecutive keys match, and
 * flushed to the sink. Nested `request.load` / `environment.activate` events
 * are skipped while an atomic workspace open is in flight.
 *
 * @param action - Dispatched Redux action.
 * @param getState - Returns the post-reducer root state for identity lookups.
 */
export function processWorkflowAction(action: UnknownAction, getState: () => RootState): void {
  updateWorkspaceFanOutSuppress(action);

  if (!recording || recordingMuted) {
    return;
  }

  const entry = registryMap.get(action.type);
  if (entry == null) {
    return;
  }

  if (suppressWorkspaceFanOut && WORKSPACE_FANOUT_SUPPRESSED_EVENT_TYPES.has(entry.eventType)) {
    return;
  }

  const candidate = entry.record(action, {
    prev: sink.getEvents().at(-1) ?? null,
    buffered: coalescer.peek(),
    getState
  });
  if (candidate == null) {
    return;
  }

  const key = entry.coalesceKey?.(candidate) ?? candidate.type;
  const checkpoint = captureWorkflowRecordCheckpoint(getState(), getElapsedMs());
  const flushed = coalescer.push(candidate, key);
  if (flushed != null && pendingCheckpoint != null) {
    appendEventWithCheckpoint(flushed, pendingCheckpoint);
  }
  pendingCheckpoint = checkpoint;
}

/**
 * Returns the public workflow log API used by `window.__workflowLog`.
 *
 * @returns Workflow log inspection API.
 */
export function getWorkflowLogApi(): WorkflowLogApi {
  return {
    /**
     * Returns flushed events, promoting any buffered candidate first.
     */
    get events(): WorkflowEvent[] {
      return getSessionEvents();
    },
    /**
     * Returns whether recording is active.
     */
    get isRecording(): boolean {
      return recording;
    },
    /**
     * Returns elapsed recording time including any open segment.
     */
    get elapsedMs(): number {
      return getElapsedMs();
    },
    /**
     * Clears retained workflow events and the coalesce buffer.
     */
    clear(): void {
      clearSession();
    },
    /**
     * Flushes the coalesce buffer into the sink.
     */
    flush(): void {
      flushBuffer();
    },
    /**
     * Starts or resumes recording.
     */
    start(): void {
      startRecording();
    },
    /**
     * Stops recording without clearing the session.
     */
    stop(): void {
      stopRecording();
    },
    /**
     * Subscribes to flushed sink updates.
     *
     * @param listener - Called after append/clear.
     * @returns Unsubscribe function.
     */
    subscribe(listener): () => void {
      return sink.subscribe(listener);
    },
    /**
     * Subscribes to recording session changes.
     *
     * @param listener - Called when recording or elapsed time changes.
     * @returns Unsubscribe function.
     */
    subscribeSession(listener): () => void {
      return subscribeRecordingSession(listener);
    }
  };
}

/**
 * Installs `window.__workflowLog` for renderer console inspection.
 *
 * Safe to call multiple times; reassigns the same API shape.
 */
export function installWorkflowLogGlobal(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.__workflowLog = getWorkflowLogApi();
}

/**
 * Resets recorder state for unit tests.
 */
export function resetWorkflowRecorderForTests(): void {
  clearSession();
  recordingMuted = false;
  suppressWorkspaceFanOut = false;
  resetTabCloseRecordingForTests();
}
