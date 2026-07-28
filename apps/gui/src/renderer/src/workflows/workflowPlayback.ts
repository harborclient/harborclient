import type { WorkflowAction } from '@harborclient/core/types';
import type { WorkflowPlayCtx, WorkflowRegistryEntry } from './workflowEventTypes';
import { WORKFLOW_REGISTRY } from './workflowRegistry';
import { buildWorkflowPlaybackMap } from './utils';
import { setWorkflowRecordingMuted } from './workflowRecorder';

type PlaybackListener = () => void;

export type { WorkflowPlayCtx };

const playbackMap = buildWorkflowPlaybackMap(WORKFLOW_REGISTRY);
const playbackListeners = new Set<PlaybackListener>();

let actions: WorkflowAction[] = [];
let index = 0;
let playing = false;
let elapsedMs = 0;
let segmentStartedAt: number | null = null;
let sessionLoaded = false;
let playGeneration = 0;

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
 * Stops the play loop and pauses the playback clock without clearing actions.
 */
export function stopPlayback(): void {
  if (!playing) {
    return;
  }
  playing = false;
  playGeneration += 1;
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
export function getPlaybackRegistryEntry(eventType: string): WorkflowRegistryEntry | undefined {
  return playbackMap.get(eventType);
}

/**
 * Plays remaining actions from the current cursor as fast as each await allows.
 *
 * @param ctx - Redux dispatch / getState for play handlers.
 * @returns Resolves when stopped or finished; rejects when a step fails.
 */
export async function startPlayback(ctx: WorkflowPlayCtx): Promise<void> {
  if (!sessionLoaded || playing || index >= actions.length) {
    return;
  }

  const generation = ++playGeneration;
  playing = true;
  segmentStartedAt = Date.now();
  notifyPlaybackListeners();

  try {
    while (playing && generation === playGeneration && index < actions.length) {
      const action = actions[index];
      if (action == null) {
        break;
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
  actions = [];
  index = 0;
  elapsedMs = 0;
  segmentStartedAt = null;
  sessionLoaded = false;
  setWorkflowRecordingMuted(false);
  playbackListeners.clear();
}
