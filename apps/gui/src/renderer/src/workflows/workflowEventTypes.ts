/**
 * A normalized workflow activity event recorded from Redux.
 */
export interface WorkflowEvent {
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
}

/**
 * Registry entry that maps one or more Redux action types onto a workflow event.
 */
export interface WorkflowRegistryEntry {
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
   * Builds the coalesce key for a candidate event. Consecutive events with the same
   * key replace the buffer (last write wins) until a different key arrives.
   *
   * @param event - Candidate event from {@link record}.
   * @returns Coalesce key; defaults to `event.type` when omitted.
   */
  coalesceKey?: (event: WorkflowEvent) => string;
}
