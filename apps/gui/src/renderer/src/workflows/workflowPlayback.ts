import type { WorkflowAction } from '@harborclient/core/types';
import { runWorkflow } from '@harborclient/core/workflowRunner/runWorkflow';
import type { WorkflowPlayCtx } from './workflowEventTypes';
import type { WorkflowRegistryCoreEntry } from './workflowRegistryCore';
import { WORKFLOW_REGISTRY_CORE } from './workflowRegistryCore';
import { buildWorkflowPlaybackMap } from './utils';
import { resetWorkflowScriptContextForTests } from './workflowScriptContext';
import { setWorkflowRecordingMuted } from './workflowRecorder';
import {
  appendWorkflowRunLogEntry,
  beginWorkflowRunLog,
  resetWorkflowRunLogForTests
} from './workflowRunLog';
import { buildWorkflowRunRequestResultFromSend } from './buildWorkflowRunRequestResultFromSend';
import { exportCompletedWorkflowRunIfConfigured } from './exportCompletedWorkflowRunIfConfigured';
import type { RequestRunOutcome } from '#/renderer/src/store/thunks/requests';
import { isRequestTab } from '#/renderer/src/store/tabs';
import { selectActiveTab } from '#/renderer/src/store/selectors';
import { resolveEnvironmentUuid } from './workflowIdentity';

type PlaybackListener = () => void;

export type { WorkflowPlayCtx };

const playbackMap = buildWorkflowPlaybackMap(WORKFLOW_REGISTRY_CORE);
const playbackListeners = new Set<PlaybackListener>();

let actions: WorkflowAction[] = [];
let index = 0;
let playing = false;
let elapsedMs = 0;
let segmentStartedAt: number | null = null;
let sessionLoaded = false;
let playGeneration = 0;
/** UUID of the workflow loaded for playback; empty when unset. */
let workflowUuid = '';
/** When true, play runs actions back-to-back without recorded `at` waits. */
let gapless = true;
/** Pause between consecutive actions during playback, in milliseconds. */
let delayMs = 0;
/** Cancellable gap wait handle for the active play loop. */
let gapWait: { cancel: () => void } | null = null;

/**
 * Notifies subscribers that playback cursor, timer, or playing state changed.
 */
function notifyPlaybackListeners(): void {
  for (const listener of playbackListeners) {
    listener();
  }
}

/**
 * Commits the open playback timing segment into {@link elapsedMs}.
 */
function commitOpenSegment(): void {
  if (segmentStartedAt == null) {
    return;
  }
  elapsedMs += Date.now() - segmentStartedAt;
  segmentStartedAt = null;
}

/**
 * Returns elapsed playback time, including any open segment.
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
 * Cancels any in-flight gapped wait without changing play generation.
 */
function cancelGapWait(): void {
  if (gapWait == null) {
    return;
  }
  gapWait.cancel();
  gapWait = null;
}

/**
 * Sleeps until `ms` elapses or the wait is cancelled / generation advances.
 *
 * @param ms - Milliseconds to wait.
 * @param generation - Play generation that must still be current.
 * @returns Resolves true when the full wait completed; false when cancelled.
 */
function waitGapMs(ms: number, generation: number): Promise<boolean> {
  if (ms <= 0) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      gapWait = null;
      resolve(generation === playGeneration && playing);
    }, ms);

    gapWait = {
      /**
       * Aborts the pending gap sleep.
       */
      cancel: () => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve(false);
      }
    };
  });
}

/**
 * Loads actions for playback and mutes recording for the play session.
 *
 * @param nextActions - Ordered workflow actions to play.
 * @param nextWorkflowUuid - Portable workflow UUID for hc.info during script runs.
 * @param nextDelayMs - Pause between consecutive actions in milliseconds.
 */
export function loadPlayback(
  nextActions: readonly WorkflowAction[],
  nextWorkflowUuid = '',
  nextDelayMs = 0
): void {
  stopPlayback();
  actions = nextActions.map((action) => ({ ...action }));
  index = 0;
  elapsedMs = 0;
  segmentStartedAt = null;
  sessionLoaded = true;
  workflowUuid = typeof nextWorkflowUuid === 'string' ? nextWorkflowUuid.trim() : '';
  delayMs = normalizeDelayMs(nextDelayMs);
  setWorkflowRecordingMuted(true);
  notifyPlaybackListeners();
}

/**
 * Clears the playback session and unmutes recording.
 */
export function clearPlayback(): void {
  stopPlayback();
  actions = [];
  index = 0;
  elapsedMs = 0;
  segmentStartedAt = null;
  sessionLoaded = false;
  workflowUuid = '';
  delayMs = 0;
  setWorkflowRecordingMuted(false);
  notifyPlaybackListeners();
}

/**
 * Returns the UUID of the workflow loaded for playback.
 *
 * @returns Workflow UUID, or empty when unset.
 */
export function getPlaybackWorkflowUuid(): string {
  return workflowUuid;
}

/**
 * Returns whether a play session currently owns the floating dialog buffer.
 *
 * @returns True after {@link loadPlayback} until {@link clearPlayback}.
 */
export function isPlaybackSessionLoaded(): boolean {
  return sessionLoaded;
}

/**
 * Returns the current 0-based action cursor (next action to play).
 *
 * @returns Playback index.
 */
export function getPlaybackIndex(): number {
  return index;
}

/**
 * Returns how many actions are loaded for playback.
 *
 * @returns Action count.
 */
export function getPlaybackActionCount(): number {
  return actions.length;
}

/**
 * Returns a copy of the loaded playback actions.
 *
 * @returns Workflow actions for the current session.
 */
export function getPlaybackActions(): readonly WorkflowAction[] {
  return actions;
}

/**
 * Returns elapsed playback time for the current session.
 *
 * @returns Elapsed milliseconds including any open segment.
 */
export function getPlaybackElapsedMs(): number {
  return getElapsedMs();
}

/**
 * Returns whether the play loop is actively dispatching actions.
 *
 * @returns True while playing.
 */
export function isPlaying(): boolean {
  return playing;
}

/**
 * Returns whether playback skips recorded timing gaps.
 *
 * @returns True when gapless mode is enabled (default).
 */
export function isPlaybackGapless(): boolean {
  return gapless;
}

/**
 * Enables or disables gapless playback (no waits between recorded `at` times).
 *
 * @param next - True for back-to-back play; false to honor recorded gaps.
 */
export function setPlaybackGapless(next: boolean): void {
  if (gapless === next) {
    return;
  }
  gapless = next;
  notifyPlaybackListeners();
}

/**
 * Returns the configured pause between consecutive playback actions.
 *
 * @returns Delay in milliseconds.
 */
export function getPlaybackDelayMs(): number {
  return delayMs;
}

/**
 * Sets the pause between consecutive playback actions for the loaded session.
 *
 * @param next - Delay in milliseconds; invalid values become 0.
 */
export function setPlaybackDelayMs(next: number): void {
  const normalized = normalizeDelayMs(next);
  if (delayMs === normalized) {
    return;
  }
  delayMs = normalized;
  notifyPlaybackListeners();
}

/**
 * Normalizes a playback delay to a non-negative integer milliseconds value.
 *
 * @param value - Raw delay candidate.
 * @returns Clamped delay in milliseconds.
 */
function normalizeDelayMs(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.floor(value);
}

/**
 * Moves the action cursor without dispatching into Redux.
 *
 * @param delta - Steps to move (negative rewinds, positive advances).
 */
export function stepPlaybackCursor(delta: number): void {
  if (!sessionLoaded || playing) {
    return;
  }
  const next = Math.min(Math.max(index + delta, 0), actions.length);
  if (next === index) {
    return;
  }
  index = next;
  notifyPlaybackListeners();
}

/**
 * Seeks the action cursor to an absolute index without dispatching.
 *
 * @param nextIndex - Target 0-based index (clamped to `[0, actions.length]`).
 */
export function seekPlaybackTo(nextIndex: number): void {
  if (!sessionLoaded || playing) {
    return;
  }
  const next = Math.min(Math.max(Math.floor(nextIndex), 0), actions.length);
  if (next === index) {
    return;
  }
  index = next;
  notifyPlaybackListeners();
}

/**
 * Replaces the loaded playback actions without resetting elapsed time.
 *
 * Stops any active play loop, swaps the action list, and clamps the cursor so
 * timeline edits (reorder / delete) stay in sync with the UI.
 *
 * @param nextActions - Updated ordered workflow actions.
 * @param nextIndex - Optional absolute cursor; defaults to clamping the current index.
 */
export function replacePlaybackActions(
  nextActions: readonly WorkflowAction[],
  nextIndex?: number
): void {
  if (!sessionLoaded) {
    return;
  }
  stopPlayback();
  actions = nextActions.map((action) => ({ ...action }));
  const fallback = Math.min(Math.max(index, 0), actions.length);
  index =
    nextIndex == null ? fallback : Math.min(Math.max(Math.floor(nextIndex), 0), actions.length);
  notifyPlaybackListeners();
}

/**
 * Stops the play loop and pauses the playback clock without clearing actions.
 */
export function stopPlayback(): void {
  if (!playing) {
    cancelGapWait();
    return;
  }
  playing = false;
  playGeneration += 1;
  cancelGapWait();
  commitOpenSegment();
  notifyPlaybackListeners();
}

/**
 * Stops playback, resets the cursor to #0, and clears elapsed time.
 */
export function restartPlayback(): void {
  stopPlayback();
  index = 0;
  elapsedMs = 0;
  segmentStartedAt = null;
  notifyPlaybackListeners();
}

/**
 * Subscribes to playback session changes (cursor, clock, playing).
 *
 * @param listener - Called when playback state changes.
 * @returns Unsubscribe function.
 */
export function subscribePlayback(listener: PlaybackListener): () => void {
  playbackListeners.add(listener);
  return () => {
    playbackListeners.delete(listener);
  };
}

/**
 * Looks up the registry entry used to play a logical workflow event type.
 *
 * @param eventType - Logical event type from a recorded action.
 * @returns Registry entry, or undefined when unknown.
 */
export function getPlaybackRegistryEntry(eventType: string): WorkflowRegistryCoreEntry | undefined {
  return playbackMap.get(eventType);
}

/**
 * Plays remaining actions from the current cursor via the shared core runner.
 *
 * In gapless mode, each action runs as soon as the previous await finishes.
 * In gapped mode, waits until the recorded relative `at` time before each step.
 * When {@link delayMs} is greater than zero, waits that long after each completed
 * step before advancing to the next action.
 *
 * When starting from index 0, clears and reseeds the workflow run log so Results
 * reflects this run's exact execution order (including jumps). When a full run
 * started from index 0 finishes naturally, auto-exports results when configured.
 *
 * @param ctx - Redux dispatch / getState for play handlers.
 * @returns Resolves when stopped or finished; rejects when a step fails.
 */
export async function startPlayback(ctx: WorkflowPlayCtx): Promise<void> {
  if (!sessionLoaded || playing || index >= actions.length) {
    return;
  }

  const generation = ++playGeneration;
  const startIndex = index;
  const startedFromBeginning = startIndex === 0;
  const segmentWallStart = Date.now();
  playing = true;
  segmentStartedAt = segmentWallStart;
  notifyPlaybackListeners();

  const state = ctx.getState();
  const workflow = state.workflows?.items?.find((item) => item.uuid === workflowUuid);
  const activeEnvironmentId = state.environments?.activeEnvironmentId ?? null;
  const environmentUuid =
    state.environments != null ? resolveEnvironmentUuid(state, activeEnvironmentId) : null;

  if (startedFromBeginning) {
    beginWorkflowRunLog({
      workflowUuid,
      name: workflow?.name ?? 'Workflow',
      environment: environmentUuid ?? '',
      date_created: new Date().toISOString()
    });
  }

  try {
    const result = await runWorkflow({
      actions,
      workflowUuid,
      workflowName: workflow?.name ?? 'Workflow',
      environmentUuid: environmentUuid ?? '',
      delayMs,
      gapless,
      startIndex,
      executor: {
        /**
         * Plays one action through the GUI Redux registry.
         *
         * @param action - Workflow action at the cursor.
         * @returns Registry play result.
         */
        play: async (action) => {
          const entry = playbackMap.get(action.type);
          if (entry?.play == null) {
            throw new Error(`Unknown workflow action type: ${action.type}`);
          }
          return await entry.play(action, ctx);
        }
      },
      resolveLogResult: (action, playResult) =>
        resolveWorkflowRunLogResult(action, playResult, ctx),
      onIndexChange: (nextIndex) => {
        index = nextIndex;
        notifyPlaybackListeners();
      },
      onStepComplete: (entry) => {
        appendWorkflowRunLogEntry(entry.action, entry.result);
      },
      shouldStop: () => !playing || generation !== playGeneration,
      waitMs: (ms) => waitGapMs(ms, generation)
    });

    if (result.error != null) {
      if (playing && generation === playGeneration) {
        stopPlayback();
      }
      throw result.error;
    }

    if (playing && generation === playGeneration) {
      const completedFullRun =
        startedFromBeginning &&
        result.completed &&
        result.lastIndex >= actions.length &&
        actions.length > 0;
      stopPlayback();
      if (completedFullRun) {
        await exportCompletedWorkflowRunIfConfigured(ctx.getState);
      }
    }
  } catch (error) {
    if (playing && generation === playGeneration) {
      stopPlayback();
    }
    throw error;
  }
}

/**
 * Resolves the run-log result entry for a completed playback step.
 *
 * @param action - Workflow action that just played.
 * @param playResult - Value returned by the registry play handler.
 * @param ctx - Playback Redux context for draft lookup on request sends.
 * @returns Export entry for the run log.
 */
function resolveWorkflowRunLogResult(
  action: WorkflowAction,
  playResult: unknown,
  ctx: WorkflowPlayCtx
): unknown {
  if (action.type !== 'request.send') {
    return action.payload;
  }

  if (!isRequestRunOutcome(playResult)) {
    return action.payload;
  }

  const activeTab = selectActiveTab(ctx.getState());
  if (activeTab == null || !isRequestTab(activeTab)) {
    return action.payload;
  }

  return buildWorkflowRunRequestResultFromSend(activeTab.draft, playResult, ctx.getState());
}

/**
 * Returns whether a play-handler return value is a request send outcome.
 *
 * @param value - Unknown play result.
 * @returns True when the value looks like {@link RequestRunOutcome}.
 */
function isRequestRunOutcome(value: unknown): value is RequestRunOutcome {
  return (
    value != null &&
    typeof value === 'object' &&
    'response' in value &&
    'testResults' in value &&
    'data' in value &&
    'cookies' in value
  );
}

/**
 * Resets playback module state for unit tests.
 */
export function resetWorkflowPlaybackForTests(): void {
  playGeneration += 1;
  playing = false;
  cancelGapWait();
  actions = [];
  index = 0;
  elapsedMs = 0;
  segmentStartedAt = null;
  sessionLoaded = false;
  workflowUuid = '';
  gapless = true;
  delayMs = 0;
  setWorkflowRecordingMuted(false);
  playbackListeners.clear();
  resetWorkflowScriptContextForTests();
  resetWorkflowRunLogForTests();
}
