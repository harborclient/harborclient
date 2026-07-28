import type { WorkflowAction } from '@harborclient/core/types';
import type { WorkflowPlayCtx } from './workflowEventTypes';
import type { WorkflowRegistryCoreEntry } from './workflowRegistryCore';
import { WORKFLOW_REGISTRY_CORE } from './workflowRegistryCore';
import { buildWorkflowPlaybackMap } from './utils';
import { setWorkflowRecordingMuted } from './workflowRecorder';

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
/** When true, play runs actions back-to-back without recorded `at` waits. */
let gapless = true;
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
 */
export function loadPlayback(nextActions: readonly WorkflowAction[]): void {
  stopPlayback();
  actions = nextActions.map((action) => ({ ...action }));
  index = 0;
  elapsedMs = 0;
  segmentStartedAt = null;
  sessionLoaded = true;
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
  setWorkflowRecordingMuted(false);
  notifyPlaybackListeners();
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
 * Plays remaining actions from the current cursor.
 *
 * In gapless mode, each action runs as soon as the previous await finishes.
 * In gapped mode, waits until the recorded relative `at` time before each step.
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
  const baseAt = actions[startIndex]?.at;
  const segmentWallStart = Date.now();
  playing = true;
  segmentStartedAt = segmentWallStart;
  notifyPlaybackListeners();

  try {
    while (playing && generation === playGeneration && index < actions.length) {
      const action = actions[index];
      if (action == null) {
        break;
      }

      if (!gapless && typeof baseAt === 'number' && typeof action.at === 'number') {
        const targetDelay = action.at - baseAt;
        const elapsed = Date.now() - segmentWallStart;
        const waitMs = Math.max(0, targetDelay - elapsed);
        const completed = await waitGapMs(waitMs, generation);
        if (!completed || !playing || generation !== playGeneration) {
          return;
        }
      }

      const entry = playbackMap.get(action.type);
      if (entry?.play == null) {
        throw new Error(`Unknown workflow action type: ${action.type}`);
      }

      await entry.play(action, ctx);

      if (!playing || generation !== playGeneration) {
        return;
      }

      index += 1;
      notifyPlaybackListeners();
    }
  } catch (error) {
    if (playing && generation === playGeneration) {
      stopPlayback();
    }
    throw error;
  }

  if (playing && generation === playGeneration) {
    stopPlayback();
  }
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
  gapless = true;
  setWorkflowRecordingMuted(false);
  playbackListeners.clear();
}
