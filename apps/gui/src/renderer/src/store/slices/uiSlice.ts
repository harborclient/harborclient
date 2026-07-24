import { createSlice } from '@reduxjs/toolkit';
import type { RootState } from '#/renderer/src/store/redux';

export interface UiState {
  pendingCount: number;
}

const initialState: UiState = {
  pendingCount: 0
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    /**
     * Increments the global in-flight operation counter.
     */
    operationStarted(state) {
      state.pendingCount += 1;
    },
    /**
     * Decrements the global in-flight operation counter.
     */
    operationFinished(state) {
      state.pendingCount = Math.max(0, state.pendingCount - 1);
    }
  }
});

export const { operationStarted, operationFinished } = uiSlice.actions;

/**
 * Returns true when async operations are in flight.
 */
export const selectIsBusy = (state: RootState): boolean => state.ui.pendingCount > 0;

export default uiSlice.reducer;
