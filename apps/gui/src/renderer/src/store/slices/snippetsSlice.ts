import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Snippet } from '#/shared/types';

export interface SnippetsState {
  snippets: Snippet[];
}

const initialState: SnippetsState = {
  snippets: []
};

const snippetsSlice = createSlice({
  name: 'snippets',
  initialState,
  reducers: {
    /**
     * Replaces the snippets list from a refresh.
     */
    setSnippets(state, action: PayloadAction<Snippet[]>) {
      state.snippets = action.payload;
    }
  }
});

export const { setSnippets } = snippetsSlice.actions;
export default snippetsSlice.reducer;
