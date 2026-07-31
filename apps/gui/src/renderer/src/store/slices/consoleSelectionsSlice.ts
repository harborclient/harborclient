import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ConsoleRowSnapshot } from '@harborclient/core/ai/scriptReferences';
import type { RootState } from '#/renderer/src/store/redux';

/**
 * Ephemeral `@console` row snapshots keyed by reference token.
 */
export interface ConsoleSelectionsState {
  /**
   * Console/header/timing row snapshots keyed by the full `@console` token.
   */
  selectionSnapshots: Record<string, ConsoleRowSnapshot>;
}

const initialState: ConsoleSelectionsState = {
  selectionSnapshots: {}
};

const consoleSelectionsSlice = createSlice({
  name: 'consoleSelections',
  initialState,
  reducers: {
    /**
     * Stores a console-row snapshot for an `@console` reference token.
     */
    setConsoleSelection(
      state,
      action: PayloadAction<{ token: string; snapshot: ConsoleRowSnapshot }>
    ) {
      state.selectionSnapshots[action.payload.token] = action.payload.snapshot;
    }
  }
});

export const { setConsoleSelection } = consoleSelectionsSlice.actions;

/**
 * Returns console-row snapshots keyed by `@console` reference token.
 *
 * @param state - Current Redux root state.
 * @returns Snapshots keyed by the full `@console` reference token.
 */
export const selectConsoleSelections = (state: RootState): Record<string, ConsoleRowSnapshot> =>
  state.consoleSelections.selectionSnapshots;

export default consoleSelectionsSlice.reducer;
