import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { CopiedScriptRef } from '#/shared/types/script';
import type { RootState } from '#/renderer/src/store/redux';

/**
 * Redux state for the in-memory script copy/paste clipboard.
 */
export interface ScriptClipboardState {
  /**
   * Last copied script payload, or null when nothing has been copied.
   */
  copied: CopiedScriptRef | null;
}

const initialState: ScriptClipboardState = {
  copied: null
};

const scriptClipboardSlice = createSlice({
  name: 'scriptClipboard',
  initialState,
  reducers: {
    /**
     * Stores one script payload for later paste operations.
     */
    setCopiedScript(state, action: PayloadAction<CopiedScriptRef>) {
      state.copied = action.payload;
    }
  }
});

export const { setCopiedScript } = scriptClipboardSlice.actions;

/**
 * Selects the current script clipboard payload.
 */
export function selectCopiedScriptRef(state: RootState): CopiedScriptRef | null {
  return state.scriptClipboard.copied;
}

export default scriptClipboardSlice.reducer;
