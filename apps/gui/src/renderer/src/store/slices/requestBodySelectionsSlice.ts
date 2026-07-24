import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RequestBodySelectionSnapshot } from '#/shared/ai/scriptReferences';
import type { RootState } from '#/renderer/src/store/redux';

/**
 * Ephemeral raw-body selection snapshots keyed by `@body` reference token.
 */
export interface RequestBodySelectionsState {
  /**
   * Raw-body selection snapshots keyed by the full `@body` reference token.
   */
  selectionSnapshots: Record<string, RequestBodySelectionSnapshot>;
}

const initialState: RequestBodySelectionsState = {
  selectionSnapshots: {}
};

const requestBodySelectionsSlice = createSlice({
  name: 'requestBodySelections',
  initialState,
  reducers: {
    /**
     * Stores a raw-body selection snapshot for an `@body` reference token.
     */
    setRequestBodySelection(
      state,
      action: PayloadAction<{ token: string; snapshot: RequestBodySelectionSnapshot }>
    ) {
      state.selectionSnapshots[action.payload.token] = action.payload.snapshot;
    }
  }
});

export const { setRequestBodySelection } = requestBodySelectionsSlice.actions;

/**
 * Returns raw-body selection snapshots keyed by `@body` reference token.
 *
 * @param state - Current Redux root state.
 * @returns Snapshots keyed by the full `@body` reference token.
 */
export const selectRequestBodySelections = (
  state: RootState
): Record<string, RequestBodySelectionSnapshot> => state.requestBodySelections.selectionSnapshots;

export default requestBodySelectionsSlice.reducer;
