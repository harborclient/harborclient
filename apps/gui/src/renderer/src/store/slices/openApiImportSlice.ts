import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ImportFilePayload } from '@harborclient/core/types';
import type { RootState } from '#/renderer/src/store/redux';

/**
 * Ephemeral File → Import session for an OpenAPI 3.x spec awaiting preview.
 */
export type OpenApiImportSession = ImportFilePayload;

/**
 * Redux state for the built-in OpenAPI import preview workflow.
 */
export interface OpenApiImportState {
  /**
   * Pending spec contents from File → Import, or null when idle.
   */
  session: OpenApiImportSession | null;
}

const initialState: OpenApiImportState = {
  session: null
};

const openApiImportSlice = createSlice({
  name: 'openApiImport',
  initialState,
  reducers: {
    /**
     * Stages a picked OpenAPI file for the Import OpenAPI page tab.
     */
    setOpenApiImportSession(state, action: PayloadAction<OpenApiImportSession>) {
      state.session = action.payload;
    },

    /**
     * Clears the pending OpenAPI import session after it is consumed or discarded.
     */
    clearOpenApiImportSession(state) {
      state.session = null;
    }
  }
});

export const { setOpenApiImportSession, clearOpenApiImportSession } = openApiImportSlice.actions;

/**
 * Selects the pending OpenAPI import session, if any.
 *
 * @param state - Root Redux state.
 * @returns Staged import file payload or null.
 */
export function selectOpenApiImportSession(state: RootState): OpenApiImportSession | null {
  return state.openApiImport.session;
}

export default openApiImportSlice.reducer;
