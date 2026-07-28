import type { UnknownAction } from '@reduxjs/toolkit';
import type { RootState } from '#/renderer/src/store/redux';
import {
  OPEN_WORKSPACE_FULFILLED_TYPE,
  OPEN_WORKSPACE_PENDING_TYPE,
  OPEN_WORKSPACE_REJECTED_TYPE
} from '#/renderer/src/store/thunks/openWorkspaceType';
import { WorkflowCoalescer } from './workflowCoalescer';
import { WorkflowEventSink } from './workflowEventSink';
import type { WorkflowEvent } from './workflowEventTypes';
import { WORKFLOW_REGISTRY_CORE } from './workflowRegistryCore';
import { buildWorkflowRegistryMap } from './utils';
import { resetTabCloseRecordingForTests } from './workflowTabCloseBridge';

type SessionListener = () => void;

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

let recording = false;
let recordingMuted = false;
let suppressWorkspaceFanOut = false;
let elapsedMs = 0;
let segmentStartedAt: number | null = null;

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
  if (flushed != null) {
    sink.append(flushed);
  }
}

/**
 * Starts or resumes the recording session so Redux actions append to the log.
 */
export function startRecording(): void {
  if (recording) {
    return;
  }
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
 * Clears session events, coalesce buffer, and elapsed timer.
 */
export function clearSession(): void {
  coalescer.flush();
  sink.clear();
  recording = false;
  elapsedMs = 0;
  segmentStartedAt = null;
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
  const flushed = coalescer.push(candidate, key);
  if (flushed != null) {
    sink.append(flushed);
  }
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
