import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ResponseSectionSnapshot } from '@harborclient/core/ai/scriptReferences';
import type { RootState } from '#/renderer/src/store/redux';

/**
 * Ephemeral response-section snapshots keyed by `@res` reference token.
 */
export interface ResponseSelectionsState {
  /**
   * Response-section snapshots keyed by the full `@res` reference token.
   */
  selectionSnapshots: Record<string, ResponseSectionSnapshot>;
}

const initialState: ResponseSelectionsState = {
  selectionSnapshots: {}
};

const responseSelectionsSlice = createSlice({
  name: 'responseSelections',
  initialState,
  reducers: {
    /**
     * Stores a response-section snapshot for an `@res` reference token.
     */
    setResponseSelection(
      state,
      action: PayloadAction<{ token: string; snapshot: ResponseSectionSnapshot }>
    ) {
      state.selectionSnapshots[action.payload.token] = action.payload.snapshot;
    }
  }
});

export const { setResponseSelection } = responseSelectionsSlice.actions;

/**
 * Returns response-section snapshots keyed by `@res` reference token.
 *
 * @param state - Current Redux root state.
 * @returns Snapshots keyed by the full `@res` reference token.
 */
export const selectResponseSelections = (
  state: RootState
): Record<string, ResponseSectionSnapshot> => state.responseSelections.selectionSnapshots;

export default responseSelectionsSlice.reducer;
