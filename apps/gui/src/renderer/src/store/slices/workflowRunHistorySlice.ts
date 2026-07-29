import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { WorkflowRunHistoryEntry } from '@harborclient/core/types/workflowRunHistory';
import type { RootState } from '#/renderer/src/store/redux';

/**
 * Redux state for persisted workflow run history entries.
 */
export interface WorkflowRunHistoryState {
  /**
   * Recent completed workflow runs shown in the Workflows History sidebar.
   */
  items: WorkflowRunHistoryEntry[];
}

const initialState: WorkflowRunHistoryState = {
  items: []
};

const workflowRunHistorySlice = createSlice({
  name: 'workflowRunHistory',
  initialState,
  reducers: {
    /**
     * Replaces the workflow run history list after refresh or persistence.
     */
    setWorkflowRunHistory(state, action: PayloadAction<WorkflowRunHistoryEntry[]>) {
      state.items = action.payload;
    },

    /**
     * Clears cached workflow run history after deletion.
     */
    clearWorkflowRunHistoryState(state) {
      state.items = [];
    }
  }
});

export const { setWorkflowRunHistory, clearWorkflowRunHistoryState } =
  workflowRunHistorySlice.actions;

/**
 * Selects all workflow run history entries currently loaded in the store.
 */
export function selectWorkflowRunHistory(state: RootState): WorkflowRunHistoryEntry[] {
  return state.workflowRunHistory.items;
}

export default workflowRunHistorySlice.reducer;
