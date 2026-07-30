import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Website } from '@harborclient/core/types';

/**
 * Redux state for persisted websites in the local registry.
 */
export interface WebsitesState {
  /**
   * Websites loaded from the local registry.
   */
  items: Website[];
}

const initialState: WebsitesState = {
  items: []
};

const websitesSlice = createSlice({
  name: 'websites',
  initialState,
  reducers: {
    /**
     * Replaces the website list after refresh or persistence.
     */
    setWebsites(state, action: PayloadAction<Website[]>) {
      state.items = action.payload;
    }
  }
});

export const { setWebsites } = websitesSlice.actions;

export default websitesSlice.reducer;
