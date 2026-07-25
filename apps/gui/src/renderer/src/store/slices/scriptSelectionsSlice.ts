import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ScriptSelectionSnapshot } from '@harborclient/core/ai/scriptReferences';
import type { RootState } from '#/renderer/src/store/redux';

/**
 * Ephemeral request-script selection snapshots keyed by `@` script reference token.
 */
export interface ScriptSelectionsState {
  /**
   * Script selection snapshots keyed by the full `@` script reference token.
   */
  selectionSnapshots: Record<string, ScriptSelectionSnapshot>;
}

const initialState: ScriptSelectionsState = {
  selectionSnapshots: {}
};

const scriptSelectionsSlice = createSlice({
  name: 'scriptSelections',
  initialState,
  reducers: {
    /**
     * Stores a request-script selection snapshot for an `@` script reference token.
     */
    setScriptSelection(
      state,
      action: PayloadAction<{ token: string; snapshot: ScriptSelectionSnapshot }>
    ) {
      state.selectionSnapshots[action.payload.token] = action.payload.snapshot;
    }
  }
});

export const { setScriptSelection } = scriptSelectionsSlice.actions;

/**
 * Returns request-script selection snapshots keyed by `@` script reference token.
 *
 * @param state - Current Redux root state.
 * @returns Snapshots keyed by the full `@` script reference token.
 */
export const selectScriptSelections = (state: RootState): Record<string, ScriptSelectionSnapshot> =>
  state.scriptSelections.selectionSnapshots;

export default scriptSelectionsSlice.reducer;
