import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Workspace } from '@harborclient/core/types/workspace';
import type { RootState } from '#/renderer/src/store/redux';

/**
 * Redux state for persisted workspaces.
 */
export interface WorkspaceState {
  /**
   * Workspaces loaded from the local registry.
   */
  items: Workspace[];
}

const initialState: WorkspaceState = {
  items: []
};

const workspaceSlice = createSlice({
  name: 'workspaces',
  initialState,
  reducers: {
    /**
     * Replaces the workspace list after refresh or persistence.
     */
    setWorkspaces(state, action: PayloadAction<Workspace[]>) {
      state.items = action.payload;
    },

    /**
     * Optimistically reorders workspaces to match drag-and-drop before IPC persistence.
     */
    reorderWorkspacesLocal(state, action: PayloadAction<number[]>) {
      const orderedWorkspaceIds = action.payload;
      if (orderedWorkspaceIds.length !== state.items.length) {
        return;
      }

      const groupsById = new Map(state.items.map((group) => [group.id, group]));
      const reordered = orderedWorkspaceIds.map((id) => groupsById.get(id));
      if (reordered.some((group) => group == null)) {
        return;
      }

      state.items = reordered as Workspace[];
    }
  }
});

export const { setWorkspaces, reorderWorkspacesLocal } = workspaceSlice.actions;

/**
 * Selects all workspaces currently loaded in the store.
 */
export function selectWorkspaces(state: RootState): Workspace[] {
  return state.workspaces.items;
}

export default workspaceSlice.reducer;
