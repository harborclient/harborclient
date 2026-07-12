import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { MarkdownSelectionSnapshot } from '#/shared/ai/scriptReferences';
import type { RootState } from '#/renderer/src/store/redux';

/**
 * Ephemeral markdown selection snapshots keyed by `@markdown` reference token.
 */
export interface MarkdownSelectionsState {
  /**
   * Markdown selection snapshots keyed by the full `@markdown` reference token.
   */
  selectionSnapshots: Record<string, MarkdownSelectionSnapshot>;
}

const initialState: MarkdownSelectionsState = {
  selectionSnapshots: {}
};

const markdownSelectionsSlice = createSlice({
  name: 'markdownSelections',
  initialState,
  reducers: {
    /**
     * Stores a markdown selection snapshot for an `@markdown` reference token.
     */
    setMarkdownSelection(
      state,
      action: PayloadAction<{ token: string; snapshot: MarkdownSelectionSnapshot }>
    ) {
      state.selectionSnapshots[action.payload.token] = action.payload.snapshot;
    }
  }
});

export const { setMarkdownSelection } = markdownSelectionsSlice.actions;

/**
 * Returns markdown selection snapshots keyed by `@markdown` reference token.
 */
export const selectMarkdownSelections = (
  state: RootState
): Record<string, MarkdownSelectionSnapshot> => state.markdownSelections.selectionSnapshots;

export default markdownSelectionsSlice.reducer;
