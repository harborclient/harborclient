import type {
  AiChatActiveTurn,
  AiChatHandoffPresentation,
  AiChatPendingQuestion,
  AiChatToolRow,
  AiChatTurnPhase
} from '#/renderer/src/store/slices/aiChatSlice';

/**
 * Props consumed by the live active turn presentation component.
 */
export interface ActiveTurnPresentationModel {
  /**
   * Live assistant markdown for the in-flight or handoff turn.
   */
  text: string;

  /**
   * Ephemeral thought markdown when the turn is not paused for user input.
   */
  thought: string;

  /**
   * Visible tool progress rows for the active turn.
   */
  toolRows: AiChatToolRow[];

  /**
   * Lifecycle phase driving waiting and thinking presentation.
   */
  phase: AiChatTurnPhase;

  /**
   * Pending `ask_user` question while the turn is paused.
   */
  pendingQuestion?: AiChatPendingQuestion;
}

/**
 * Builds presentation props from active turn state or a post-stream handoff snapshot.
 *
 * @param activeTurn - In-flight turn from Redux when present.
 * @param handoff - Brief handoff markdown after `turn.end` until persistence.
 * @returns Props for live turn presentation or null when nothing should render.
 */
export function buildActiveTurnPresentationProps(
  activeTurn: AiChatActiveTurn | undefined,
  handoff: AiChatHandoffPresentation | undefined
): ActiveTurnPresentationModel | null {
  if (activeTurn != null) {
    return {
      text: activeTurn.text,
      thought: activeTurn.thought,
      toolRows: activeTurn.toolRows,
      phase: activeTurn.phase,
      pendingQuestion: activeTurn.pendingQuestion
    };
  }

  if (handoff != null) {
    return {
      text: handoff.text,
      thought: '',
      toolRows: [],
      phase: 'idle'
    };
  }

  return null;
}
