import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RequestHistoryEntry } from '#/shared/types/requestHistory';
import type { RootState } from '#/renderer/src/store/redux';

/**
 * Redux state for persisted request history entries.
 */
export interface RequestHistoryState {
  /**
   * Recent HTTP exchanges shown in the History sidebar.
   */
  items: RequestHistoryEntry[];
}

const initialState: RequestHistoryState = {
  items: []
};

const requestHistorySlice = createSlice({
  name: 'requestHistory',
  initialState,
  reducers: {
    /**
     * Replaces the request history list after refresh or persistence.
     */
    setRequestHistory(state, action: PayloadAction<RequestHistoryEntry[]>) {
      state.items = action.payload;
    },

    /**
     * Clears cached request history after deletion.
     */
    clearRequestHistoryState(state) {
      state.items = [];
    }
  }
});

export const { setRequestHistory, clearRequestHistoryState } = requestHistorySlice.actions;

/**
 * Selects all request history entries currently loaded in the store.
 */
export function selectRequestHistory(state: RootState): RequestHistoryEntry[] {
  return state.requestHistory.items;
}

export default requestHistorySlice.reducer;
