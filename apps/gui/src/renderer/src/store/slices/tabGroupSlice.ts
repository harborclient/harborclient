import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { TabGroup } from '#/shared/types/tabGroup';
import type { RootState } from '#/renderer/src/store/redux';

/**
 * Payload for entering tab group edit mode.
 */
export interface StartEditingTabGroupPayload {
  /**
   * Tab group being edited.
   */
  groupId: number;

  /**
   * Open tab ids that were already open before edit and are not group members.
   */
  hiddenTabIds: string[];
}

/**
 * Redux state for persisted tab groups and transient edit sessions.
 */
export interface TabGroupState {
  /**
   * Tab groups loaded from the local registry.
   */
  items: TabGroup[];

  /**
   * Tab group currently in edit mode, if any.
   */
  editingTabGroupId: number | null;

  /**
   * Open tabs hidden from the tab bar during the current edit session.
   */
  editSessionHiddenTabIds: string[];
}

const initialState: TabGroupState = {
  items: [],
  editingTabGroupId: null,
  editSessionHiddenTabIds: []
};

const tabGroupSlice = createSlice({
  name: 'tabGroups',
  initialState,
  reducers: {
    /**
     * Replaces the tab group list after refresh or persistence.
     */
    setTabGroups(state, action: PayloadAction<TabGroup[]>) {
      state.items = action.payload;
    },

    /**
     * Enters tab group edit mode and records tabs hidden from the tab bar.
     */
    startEditingTabGroup(state, action: PayloadAction<StartEditingTabGroupPayload>) {
      state.editingTabGroupId = action.payload.groupId;
      state.editSessionHiddenTabIds = action.payload.hiddenTabIds;
    },

    /**
     * Exits tab group edit mode and restores hidden tabs in the tab bar.
     */
    stopEditingTabGroup(state) {
      state.editingTabGroupId = null;
      state.editSessionHiddenTabIds = [];
    },
    /**
     * Optimistically reorders tab groups to match drag-and-drop before IPC persistence.
     */
    reorderTabGroupsLocal(state, action: PayloadAction<number[]>) {
      const orderedTabGroupIds = action.payload;
      if (orderedTabGroupIds.length !== state.items.length) {
        return;
      }

      const groupsById = new Map(state.items.map((group) => [group.id, group]));
      const reordered = orderedTabGroupIds.map((id) => groupsById.get(id));
      if (reordered.some((group) => group == null)) {
        return;
      }

      state.items = reordered as TabGroup[];
    }
  }
});

export const { setTabGroups, startEditingTabGroup, stopEditingTabGroup, reorderTabGroupsLocal } =
  tabGroupSlice.actions;

/**
 * Selects all tab groups currently loaded in the store.
 */
export function selectTabGroups(state: RootState): TabGroup[] {
  return state.tabGroups.items;
}

/**
 * Selects the tab group id currently being edited, if any.
 */
export function selectEditingTabGroupId(state: RootState): number | null {
  return state.tabGroups.editingTabGroupId;
}

/**
 * Selects open tab ids hidden during the current tab group edit session.
 */
export function selectEditSessionHiddenTabIds(state: RootState): string[] {
  return state.tabGroups.editSessionHiddenTabIds;
}

/**
 * Selects the tab group currently being edited, if any.
 */
export function selectEditingTabGroup(state: RootState): TabGroup | null {
  const editingTabGroupId = state.tabGroups.editingTabGroupId;
  if (editingTabGroupId == null) {
    return null;
  }

  return state.tabGroups.items.find((group) => group.id === editingTabGroupId) ?? null;
}

export default tabGroupSlice.reducer;
