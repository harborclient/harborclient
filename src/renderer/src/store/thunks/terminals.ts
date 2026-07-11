import { createAsyncThunk } from '@reduxjs/toolkit';
import { hydrateTerminals, type TerminalsState } from '#/renderer/src/store/slices/terminalsSlice';
import { loadTerminalLayout } from '#/renderer/src/store/persistence';
import type { ThunkApiConfig } from '#/renderer/src/store/redux';

/**
 * Hydrates persisted footer terminal layout from localStorage on app startup.
 */
export const hydrateTerminalLayout = createAsyncThunk<void, void, ThunkApiConfig>(
  'terminals/hydrateTerminalLayout',
  async (_arg, { dispatch }) => {
    const layout: TerminalsState = loadTerminalLayout();
    dispatch(hydrateTerminals(layout));
  }
);
