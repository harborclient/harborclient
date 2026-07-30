import type { Tab } from '#/renderer/src/store/tabs';
import type { AppDispatch, RootState } from '#/renderer/src/store/redux';
import { restoreTabsState } from '#/renderer/src/store/slices/tabsSlice';
import { setActiveEnvironmentId } from '#/renderer/src/store/slices/environmentsSlice';

/**
 * App-state snapshot taken after a flushed recording event so paused seek can
 * rewind the UI.
 *
 * Does not undo disk writes (`request.save`, collection mutations) or fully
 * reverse `workspace.open` outside tab/environment selection. Callers must mute
 * recording while restoring so restore dispatches are not re-recorded.
 */
export interface WorkflowRecordCheckpoint {
  /**
   * Deep-cloned open tabs at capture time (includes drafts and responses).
   */
  tabs: Tab[];

  /**
   * Active tab id matching {@link tabs}.
   */
  activeTabId: string;

  /**
   * Active environment id, or null when none is selected.
   */
  activeEnvironmentId: number | null;

  /**
   * Recording elapsed milliseconds at capture time (pauses excluded).
   */
  elapsedMs: number;
}

/**
 * Captures a deep-cloned checkpoint of rewindable recording UI state.
 *
 * @param state - Root Redux state after the action that produced the event.
 * @param elapsedMs - Recording elapsed time to restore with this checkpoint.
 * @returns Immutable checkpoint safe to keep beside the event sink.
 */
export function captureWorkflowRecordCheckpoint(
  state: RootState,
  elapsedMs: number
): WorkflowRecordCheckpoint {
  const tabsState = state.tabs;
  return {
    tabs: structuredClone(tabsState?.tabs ?? []),
    activeTabId: tabsState?.activeTabId ?? '',
    activeEnvironmentId: state.environments?.activeEnvironmentId ?? null,
    elapsedMs
  };
}

/**
 * Restores tabs and active environment from a recording checkpoint.
 *
 * Recording mute is the caller's responsibility so these dispatches do not
 * append new workflow events.
 *
 * @param checkpoint - Snapshot captured after a prior recorded action.
 * @param dispatch - App dispatch used to apply restore actions.
 */
export function restoreWorkflowRecordCheckpoint(
  checkpoint: WorkflowRecordCheckpoint,
  dispatch: AppDispatch
): void {
  dispatch(
    restoreTabsState({
      tabs: structuredClone(checkpoint.tabs),
      activeTabId: checkpoint.activeTabId
    })
  );
  dispatch(setActiveEnvironmentId(checkpoint.activeEnvironmentId));
}
