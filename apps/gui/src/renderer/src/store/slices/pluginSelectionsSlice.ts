import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { PluginChatPointerSnapshot } from '@harborclient/core/ai/scriptReferences';
import type { RootState } from '#/renderer/src/store/redux';

/**
 * Ephemeral plugin chat-pointer snapshots keyed by `@plugin…` reference token.
 */
export interface PluginSelectionsState {
  /**
   * Plugin chat-pointer snapshots keyed by the full `@plugin…` reference token.
   */
  selectionSnapshots: Record<string, PluginChatPointerSnapshot>;
}

const initialState: PluginSelectionsState = {
  selectionSnapshots: {}
};

const pluginSelectionsSlice = createSlice({
  name: 'pluginSelections',
  initialState,
  reducers: {
    /**
     * Stores a plugin chat-pointer snapshot for an `@plugin…` reference token.
     */
    setPluginSelection(
      state,
      action: PayloadAction<{ token: string; snapshot: PluginChatPointerSnapshot }>
    ) {
      state.selectionSnapshots[action.payload.token] = action.payload.snapshot;
    },

    /**
     * Removes a plugin chat-pointer snapshot (e.g. when plugin parse rejects at send).
     */
    clearPluginSelection(state, action: PayloadAction<{ token: string }>) {
      delete state.selectionSnapshots[action.payload.token];
    }
  }
});

export const { setPluginSelection, clearPluginSelection } = pluginSelectionsSlice.actions;

/**
 * Returns plugin chat-pointer snapshots keyed by `@plugin…` reference token.
 *
 * @param state - Current Redux root state.
 * @returns Snapshots keyed by the full `@plugin…` reference token.
 */
export const selectPluginSelections = (
  state: RootState
): Record<string, PluginChatPointerSnapshot> => state.pluginSelections.selectionSnapshots;

export default pluginSelectionsSlice.reducer;
