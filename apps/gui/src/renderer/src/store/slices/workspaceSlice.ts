import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Workspace } from '@harborclient/core/types/workspace';
import type { RootState } from '#/renderer/src/store/redux';

/**
 * Payload for entering workspace edit mode.
 */
export interface StartEditingWorkspacePayload {
  /**
   * Workspace being edited.
   */
  groupId: number;

  /**
   * Open tab ids that were already open before edit and are not group members.
   */
  hiddenTabIds: string[];
}

/**
 * Redux state for persisted workspaces and transient edit sessions.
 */
export interface WorkspaceState {
  /**
   * Workspaces loaded from the local registry.
   */
  items: Workspace[];

  /**
   * Workspace currently in edit mode, if any.
   */
  editingWorkspaceId: number | null;

  /**
   * Open tabs hidden from the tab bar during the current edit session.
   */
  editSessionHiddenTabIds: string[];
}

const initialState: WorkspaceState = {
  items: [],
  editingWorkspaceId: null,
  editSessionHiddenTabIds: []
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
     * Enters workspace edit mode and records tabs hidden from the tab bar.
     */
    startEditingWorkspace(state, action: PayloadAction<StartEditingWorkspacePayload>) {
      state.editingWorkspaceId = action.payload.groupId;
      state.editSessionHiddenTabIds = action.payload.hiddenTabIds;
    },

    /**
     * Exits workspace edit mode and restores hidden tabs in the tab bar.
     */
    stopEditingWorkspace(state) {
      state.editingWorkspaceId = null;
      state.editSessionHiddenTabIds = [];
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

export const {
  setWorkspaces,
  startEditingWorkspace,
  stopEditingWorkspace,
  reorderWorkspacesLocal
} = workspaceSlice.actions;

/**
 * Selects all workspaces currently loaded in the store.
 */
export function selectWorkspaces(state: RootState): Workspace[] {
  return state.workspaces.items;
}

/**
 * Selects the workspace id currently being edited, if any.
 */
export function selectEditingWorkspaceId(state: RootState): number | null {
  return state.workspaces.editingWorkspaceId;
}

/**
 * Selects open tab ids hidden during the current workspace edit session.
 */
export function selectEditSessionHiddenTabIds(state: RootState): string[] {
  return state.workspaces.editSessionHiddenTabIds;
}

/**
 * Selects the workspace currently being edited, if any.
 */
export function selectEditingWorkspace(state: RootState): Workspace | null {
  const editingWorkspaceId = state.workspaces.editingWorkspaceId;
  if (editingWorkspaceId == null) {
    return null;
  }

  return state.workspaces.items.find((group) => group.id === editingWorkspaceId) ?? null;
}

export default workspaceSlice.reducer;
