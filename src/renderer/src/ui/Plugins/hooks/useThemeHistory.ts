import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CustomThemeDraft } from '#/renderer/src/ui/Plugins/hooks/useCustomTheme';
import {
  THEME_HISTORY_DEBOUNCE_MS,
  cloneCustomThemeDraft,
  commitThemeHistoryBaseline,
  createThemeHistoryState,
  recordThemeHistoryImmediate,
  redoThemeHistory,
  resetThemeHistory,
  setThemeHistoryPresent,
  undoThemeHistory,
  type ThemeHistoryState
} from '#/renderer/src/ui/Plugins/hooks/themeHistoryStack';

/**
 * Options for recording a draft change in Creator history.
 */
export interface RecordThemeHistoryOptions {
  /**
   * When true, coalesces rapid updates (such as color-picker drags) into one undo step.
   */
  debounce?: boolean;
}

/**
 * Return type for {@link useThemeHistory}.
 */
export interface UseThemeHistoryResult {
  /** Current draft shown in the Creator. */
  present: CustomThemeDraft;

  /** Whether an undo step is available. */
  canUndo: boolean;

  /** Whether a redo step is available. */
  canRedo: boolean;

  /**
   * Updates the present draft without pushing a new undo step.
   *
   * @param next - Draft value to display immediately.
   */
  setPresent: (next: CustomThemeDraft) => void;

  /**
   * Records a draft change in history, optionally debouncing coalesced updates.
   *
   * @param next - Draft value to commit.
   * @param options - Recording behavior such as debounced coalescing.
   */
  record: (next: CustomThemeDraft, options?: RecordThemeHistoryOptions) => void;

  /** Moves one step backward in history when available. */
  undo: () => void;

  /** Moves one step forward in history when available. */
  redo: () => void;

  /**
   * Replaces the history stack with a new baseline snapshot.
   *
   * @param snapshot - Draft that becomes the new present value.
   */
  reset: (snapshot: CustomThemeDraft) => void;
}

/**
 * Manages undo/redo history for Creator draft edits with debounced color coalescing.
 *
 * @param initialSnapshot - Draft used to seed the history stack.
 * @returns Present draft, availability flags, and history mutation handlers.
 */
export function useThemeHistory(initialSnapshot: CustomThemeDraft): UseThemeHistoryResult {
  const [history, setHistory] = useState<ThemeHistoryState>(() =>
    createThemeHistoryState(initialSnapshot)
  );
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceBaselineRef = useRef<CustomThemeDraft | null>(null);

  /**
   * Clears any pending debounced history commit and pushes the captured baseline.
   */
  const flushDebounce = useCallback((): void => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const baseline = debounceBaselineRef.current;
    debounceBaselineRef.current = null;
    if (baseline == null) {
      return;
    }

    setHistory((current) => commitThemeHistoryBaseline(current, baseline));
  }, []);

  /**
   * Clears debounce timers when the hook unmounts.
   */
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  /**
   * Updates the present draft without recording a new undo step.
   */
  const setPresent = useCallback((next: CustomThemeDraft): void => {
    setHistory((current) => setThemeHistoryPresent(current, next));
  }, []);

  /**
   * Records a draft change immediately, flushing any pending debounced commit first.
   */
  const recordImmediate = useCallback(
    (next: CustomThemeDraft): void => {
      flushDebounce();
      setHistory((current) => recordThemeHistoryImmediate(current, next));
    },
    [flushDebounce]
  );

  /**
   * Records rapid draft edits as one undo step after the debounce window elapses.
   */
  const recordDebounced = useCallback((next: CustomThemeDraft): void => {
    setHistory((current) => {
      if (debounceBaselineRef.current == null) {
        debounceBaselineRef.current = cloneCustomThemeDraft(current.present);
      }
      return setThemeHistoryPresent(current, next);
    });

    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      const baseline = debounceBaselineRef.current;
      debounceBaselineRef.current = null;
      if (baseline == null) {
        return;
      }
      setHistory((current) => commitThemeHistoryBaseline(current, baseline));
    }, THEME_HISTORY_DEBOUNCE_MS);
  }, []);

  /**
   * Records a draft change using immediate or debounced history semantics.
   */
  const record = useCallback(
    (next: CustomThemeDraft, options?: RecordThemeHistoryOptions): void => {
      if (options?.debounce) {
        recordDebounced(next);
        return;
      }
      recordImmediate(next);
    },
    [recordDebounced, recordImmediate]
  );

  /**
   * Moves one step backward in history when available.
   */
  const undo = useCallback((): void => {
    flushDebounce();
    setHistory((current) => undoThemeHistory(current) ?? current);
  }, [flushDebounce]);

  /**
   * Moves one step forward in history when available.
   */
  const redo = useCallback((): void => {
    flushDebounce();
    setHistory((current) => redoThemeHistory(current) ?? current);
  }, [flushDebounce]);

  /**
   * Replaces the history stack with a new baseline snapshot.
   */
  const reset = useCallback(
    (snapshot: CustomThemeDraft): void => {
      flushDebounce();
      setHistory(resetThemeHistory(snapshot));
    },
    [flushDebounce]
  );

  const canUndo = useMemo(() => history.past.length > 0, [history.past.length]);
  const canRedo = useMemo(() => history.future.length > 0, [history.future.length]);

  return {
    present: history.present,
    canUndo,
    canRedo,
    setPresent,
    record,
    undo,
    redo,
    reset
  };
}
