import type {
  AiChatActiveTurn,
  AiChatHandoffPresentation,
  AiChatTurnPhase
} from '#/renderer/src/store/slices/aiChatSlice';

/**
 * Snapshot used to derive auto-scroll keys for the live turn presentation.
 */
export interface LiveTurnScrollSnapshot {
  /**
   * Live assistant markdown length.
   */
  textLength: number;

  /**
   * Ephemeral thought markdown length.
   */
  thoughtLength: number;

  /**
   * Serialized tool row progress markers.
   */
  toolRowKey: string;

  /**
   * Active turn lifecycle phase.
   */
  phase: AiChatTurnPhase;

  /**
   * Pending `ask_user` question text when paused.
   */
  pendingQuestion?: string;
}

/**
 * Builds a scroll snapshot from an active turn or handoff presentation.
 *
 * @param activeTurn - In-flight turn state from Redux.
 * @param handoff - Brief post-stream handoff markdown when the active turn cleared.
 * @returns Snapshot for meaningful stream change detection.
 */
export function buildLiveTurnScrollSnapshot(
  activeTurn: AiChatActiveTurn | undefined,
  handoff: AiChatHandoffPresentation | undefined
): LiveTurnScrollSnapshot | null {
  if (activeTurn != null) {
    return {
      textLength: activeTurn.text.length,
      thoughtLength: activeTurn.thought.length,
      toolRowKey: activeTurn.toolRows.map((row) => `${row.callId}:${row.status}`).join(','),
      phase: activeTurn.phase,
      pendingQuestion: activeTurn.pendingQuestion?.question
    };
  }

  if (handoff != null) {
    return {
      textLength: handoff.text.length,
      thoughtLength: 0,
      toolRowKey: '',
      phase: 'idle'
    };
  }

  return null;
}

/**
 * Serializes a live turn scroll snapshot into a stable effect dependency key.
 *
 * @param snapshot - Live turn snapshot or null when no presentation is visible.
 * @returns Key that changes on meaningful stream updates.
 */
export function liveTurnScrollKey(snapshot: LiveTurnScrollSnapshot | null): string {
  if (snapshot == null) {
    return '';
  }

  return [
    snapshot.textLength,
    snapshot.thoughtLength,
    snapshot.toolRowKey,
    snapshot.phase,
    snapshot.pendingQuestion ?? ''
  ].join('|');
}
