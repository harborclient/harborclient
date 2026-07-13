import type { ThemeColorToken } from '@harborclient/sdk';
import type { CustomThemeDraft } from '#/renderer/src/ui/Plugins/hooks/useCustomTheme';

/**
 * Immutable undo/redo stack state for Designer draft snapshots.
 */
export interface ThemeHistoryState {
  /** Snapshots that can be restored by undo. */
  past: CustomThemeDraft[];

  /** Current draft shown in the Designer. */
  present: CustomThemeDraft;

  /** Snapshots that can be restored by redo. */
  future: CustomThemeDraft[];
}

/**
 * Debounce window used to coalesce rapid color-picker updates into one history step.
 */
export const THEME_HISTORY_DEBOUNCE_MS = 350;

/**
 * Deep-clones a Designer draft so history entries do not alias mutable color maps.
 *
 * @param draft - Draft snapshot to clone.
 * @returns Independent copy safe to store in the history stack.
 */
export function cloneCustomThemeDraft(draft: CustomThemeDraft): CustomThemeDraft {
  return {
    ...draft,
    colors: { ...draft.colors }
  };
}

/**
 * Compares two Designer drafts for semantic equality.
 *
 * @param left - First draft snapshot.
 * @param right - Second draft snapshot.
 * @returns True when title, type, id, and all color tokens match.
 */
export function customThemeDraftsEqual(left: CustomThemeDraft, right: CustomThemeDraft): boolean {
  if (left.id !== right.id || left.title !== right.title || left.type !== right.type) {
    return false;
  }

  const leftKeys = Object.keys(left.colors) as ThemeColorToken[];
  const rightKeys = Object.keys(right.colors) as ThemeColorToken[];
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((token) => left.colors[token] === right.colors[token]);
}

/**
 * Creates an empty history stack seeded with the provided draft.
 *
 * @param snapshot - Initial Designer draft.
 * @returns Fresh history state with no undo or redo steps.
 */
export function createThemeHistoryState(snapshot: CustomThemeDraft): ThemeHistoryState {
  return {
    past: [],
    present: cloneCustomThemeDraft(snapshot),
    future: []
  };
}

/**
 * Updates the present draft without recording a new undo step.
 *
 * @param state - Current history state.
 * @param next - Draft value to display immediately.
 * @returns History state with an updated present snapshot.
 */
export function setThemeHistoryPresent(
  state: ThemeHistoryState,
  next: CustomThemeDraft
): ThemeHistoryState {
  return {
    ...state,
    present: cloneCustomThemeDraft(next)
  };
}

/**
 * Records a new draft snapshot immediately, pushing the previous present value to past.
 *
 * @param state - Current history state.
 * @param next - Draft value to commit to history.
 * @returns Updated history state with future cleared.
 */
export function recordThemeHistoryImmediate(
  state: ThemeHistoryState,
  next: CustomThemeDraft
): ThemeHistoryState {
  if (customThemeDraftsEqual(state.present, next)) {
    return {
      ...state,
      present: cloneCustomThemeDraft(next)
    };
  }

  return {
    past: [...state.past, cloneCustomThemeDraft(state.present)],
    present: cloneCustomThemeDraft(next),
    future: []
  };
}

/**
 * Commits a debounced baseline snapshot to the undo stack.
 *
 * @param state - Current history state.
 * @param baseline - Draft snapshot captured before debounced edits began.
 * @returns Updated history state with the baseline pushed to past.
 */
export function commitThemeHistoryBaseline(
  state: ThemeHistoryState,
  baseline: CustomThemeDraft
): ThemeHistoryState {
  if (customThemeDraftsEqual(baseline, state.present)) {
    return state;
  }

  return {
    ...state,
    past: [...state.past, cloneCustomThemeDraft(baseline)],
    future: []
  };
}

/**
 * Moves one step backward in the history stack.
 *
 * @param state - Current history state.
 * @returns Updated history state, or null when undo is unavailable.
 */
export function undoThemeHistory(state: ThemeHistoryState): ThemeHistoryState | null {
  if (state.past.length === 0) {
    return null;
  }

  const previous = state.past[state.past.length - 1];
  return {
    past: state.past.slice(0, -1),
    present: cloneCustomThemeDraft(previous),
    future: [cloneCustomThemeDraft(state.present), ...state.future]
  };
}

/**
 * Moves one step forward in the history stack.
 *
 * @param state - Current history state.
 * @returns Updated history state, or null when redo is unavailable.
 */
export function redoThemeHistory(state: ThemeHistoryState): ThemeHistoryState | null {
  if (state.future.length === 0) {
    return null;
  }

  const next = state.future[0];
  return {
    past: [...state.past, cloneCustomThemeDraft(state.present)],
    present: cloneCustomThemeDraft(next),
    future: state.future.slice(1)
  };
}

/**
 * Replaces the entire history stack with a new baseline snapshot.
 *
 * @param snapshot - Draft that becomes the new present value with empty past/future.
 * @returns Reset history state.
 */
export function resetThemeHistory(snapshot: CustomThemeDraft): ThemeHistoryState {
  return createThemeHistoryState(snapshot);
}
