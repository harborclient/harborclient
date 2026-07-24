import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { SavedRunResultSummary } from '#/shared/collectionRunner';
import type { RootState } from '#/renderer/src/store/redux';

/**
 * Redux state for saved collection run result snapshots.
 */
export interface RunResultsState {
  /**
   * Aggregated run result rows from all storage providers.
   */
  items: SavedRunResultSummary[];
}

const initialState: RunResultsState = {
  items: []
};

const runResultsSlice = createSlice({
  name: 'runResults',
  initialState,
  reducers: {
    /**
     * Replaces the aggregated run result list after refresh.
     */
    setRunResults(state, action: PayloadAction<SavedRunResultSummary[]>) {
      state.items = action.payload;
    },

    /**
     * Removes one run result row from the cached list after deletion.
     */
    removeRunResult(state, action: PayloadAction<number>) {
      state.items = state.items.filter((item) => item.id !== action.payload);
    }
  }
});

export const { setRunResults, removeRunResult } = runResultsSlice.actions;

/**
 * Selects all saved run result summaries currently loaded in the store.
 */
export function selectRunResults(state: RootState): SavedRunResultSummary[] {
  return state.runResults.items;
}

export default runResultsSlice.reducer;
