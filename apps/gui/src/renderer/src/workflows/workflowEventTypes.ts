import type { WorkflowRunActionResult } from '@harborclient/core/types';
import type { ReactNode } from 'react';
import type { AppDispatch, RootState } from '#/renderer/src/store/redux';

/**
 * Context passed to registry thumbnail renderers for timeline blocks.
 */
export interface WorkflowThumbnailCtx {
  /**
   * True when this block is the current playback cursor.
   */
  selected: boolean;

  /**
   * True when the block is too narrow for secondary text.
   */
  compact: boolean;

  /**
   * Optional Redux getter for resolving display names (environments, etc.).
   */
  getState?: () => RootState;

  /**
   * Optional run-log result for this step (e.g. request send snapshot in Results).
   */
  result?: WorkflowRunActionResult;
}

/**
 * A normalized workflow activity event recorded from Redux.
 */
export interface WorkflowEvent {
  /**
   * Stable identifier for this action; used when other actions refer to it.
   */
  uuid: string;

  /**
   * Stable logical event name (not the raw Redux action type).
   */
  type: string;

  /**
   * Wall-clock time when the event was accepted for recording.
   */
  at: number;

  /**
   * Normalized payload safe for later inspection or playback.
   */
  payload: unknown;
}

/**
 * Context passed to registry handlers while normalizing a Redux action.
 */
export interface WorkflowRecordCtx {
  /**
   * Last event flushed to the sink, if any.
   */
  prev: WorkflowEvent | null;

  /**
   * Event currently held in the coalesce buffer, if any.
   */
  buffered: WorkflowEvent | null;

  /**
   * Returns the current root Redux state (post-reducer for this action).
   */
  getState: () => RootState;
}

/**
 * Redux access passed to registry play handlers during playback.
 */
export interface WorkflowPlayCtx {
  /**
   * App dispatch (supports thunks).
   */
  dispatch: AppDispatch;

  /**
   * Returns the current root Redux state.
   */
  getState: () => RootState;
}

/**
 * Registry entry that maps one or more Redux action types onto a workflow event.
 */
export interface WorkflowRegistryEntry {
  /**
   * Stable logical event type written to the session / export (for example `request.load`).
   */
  eventType: string;

  /**
   * Redux action type string(s) this entry handles (including thunk `/pending` forms).
   */
  match: string | readonly string[];

  /**
   * Normalizes a matching action into a recordable event, or returns null to skip.
   *
   * @param action - Dispatched Redux action.
   * @param ctx - Coalesce / history context for the handler.
   * @returns Event to consider for recording, or null to ignore the action.
   */
  record: (
    action: { type: string; payload?: unknown; meta?: unknown },
    ctx: WorkflowRecordCtx
  ) => WorkflowEvent | null;

  /**
   * Replays a recorded event by dispatching the corresponding Redux intent.
   *
   * @param action - Recorded workflow action (`type` + `payload`).
   * @param ctx - Dispatch / getState for resolving and applying the step.
   * @returns Optional result harvested by the run log (e.g. request send outcome).
   */
  play: (
    action: { type: string; at?: number; payload: unknown },
    ctx: WorkflowPlayCtx
  ) => void | unknown | Promise<void | unknown>;

  /**
   * Builds the coalesce key for a candidate event. Consecutive events with the same
   * key replace the buffer (last write wins) until a different key arrives.
   *
   * @param event - Candidate event from {@link record}.
   * @returns Coalesce key; defaults to `event.type` when omitted.
   */
  coalesceKey?: (event: WorkflowEvent) => string;

  /**
   * Renders the visual content shown inside a timeline block for this event type.
   *
   * @param action - Recorded workflow action (`type` + `payload`).
   * @param ctx - Selection / density context for the block.
   * @returns Thumbnail content (not the surrounding block chrome).
   */
  thumbnail: (
    action: { type: string; at?: number; payload: unknown },
    ctx: WorkflowThumbnailCtx
  ) => ReactNode;
}
