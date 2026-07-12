import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { TrashItem } from '#/shared/types/trash';
import type { RootState } from '#/renderer/src/store/redux';

/**
 * Redux state for sidebar trash snapshots.
 */
export interface TrashState {
  /**
   * Trash rows currently loaded from the registry database.
   */
  items: TrashItem[];
}

const initialState: TrashState = {
  items: []
};

const trashSlice = createSlice({
  name: 'trash',
  initialState,
  reducers: {
    /**
     * Replaces the trash list after refresh.
     */
    setTrashItems(state, action: PayloadAction<TrashItem[]>) {
      state.items = action.payload;
    },

    /**
     * Removes one trash row from the cached list after permanent deletion.
     */
    removeTrashItem(state, action: PayloadAction<number>) {
      state.items = state.items.filter((item) => item.id !== action.payload);
    }
  }
});

export const { setTrashItems, removeTrashItem } = trashSlice.actions;

/**
 * Selects all trash rows currently loaded in the store.
 */
export function selectTrashItems(state: RootState): TrashItem[] {
  return state.trash.items;
}

export default trashSlice.reducer;
