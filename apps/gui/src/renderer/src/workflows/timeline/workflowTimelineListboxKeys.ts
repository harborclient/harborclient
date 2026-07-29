/**
 * Result of mapping a listbox key event to a seek or menu action.
 */
export type WorkflowTimelineListboxKeyAction =
  | { type: 'seek'; index: number }
  | { type: 'openMenu' }
  | null;

interface ResolveParams {
  /**
   * Key from the keyboard event (`event.key`).
   */
  key: string;

  /**
   * True when Shift is held (used for Shift+F10).
   */
  shiftKey: boolean;

  /**
   * Current selected / active action index.
   */
  selectedIndex: number;

  /**
   * Total number of actions in the timeline.
   */
  actionCount: number;

  /**
   * When true, seek and menu actions are suppressed (playback or recording).
   */
  playing: boolean;

  /**
   * When true, ContextMenu / Shift+F10 may open the action menu.
   */
  editable: boolean;
}

/**
 * Clamps an index into the valid action range `[0, actionCount - 1]`.
 *
 * @param index - Candidate index.
 * @param actionCount - Total actions.
 * @returns Clamped index, or `-1` when there are no actions.
 */
function clampActionIndex(index: number, actionCount: number): number {
  if (actionCount <= 0) {
    return -1;
  }
  return Math.max(0, Math.min(actionCount - 1, index));
}

/**
 * Maps a listbox keyboard event to seek navigation or opening the action menu.
 *
 * Supports ArrowLeft/ArrowRight, Home/End, Enter/Space (re-seek current), and
 * ContextMenu / Shift+F10 when editable. Returns null when the key is ignored
 * or when playback locks interaction.
 *
 * @param params - Key, modifiers, selection, and mode flags.
 * @returns Seek/menu action, or null when the event should not be handled.
 */
export function resolveWorkflowTimelineListboxKey(
  params: ResolveParams
): WorkflowTimelineListboxKeyAction {
  const { key, shiftKey, selectedIndex, actionCount, playing, editable } = params;

  if (playing || actionCount <= 0) {
    return null;
  }

  if (key === 'ContextMenu' || (key === 'F10' && shiftKey)) {
    if (!editable) {
      return null;
    }
    const index = clampActionIndex(selectedIndex, actionCount);
    if (index < 0) {
      return null;
    }
    return { type: 'openMenu' };
  }

  if (key === 'ArrowLeft') {
    return { type: 'seek', index: clampActionIndex(selectedIndex - 1, actionCount) };
  }

  if (key === 'ArrowRight') {
    return { type: 'seek', index: clampActionIndex(selectedIndex + 1, actionCount) };
  }

  if (key === 'Home') {
    return { type: 'seek', index: 0 };
  }

  if (key === 'End') {
    return { type: 'seek', index: actionCount - 1 };
  }

  if (key === 'Enter' || key === ' ') {
    const index = clampActionIndex(selectedIndex, actionCount);
    if (index < 0) {
      return null;
    }
    return { type: 'seek', index };
  }

  return null;
}
