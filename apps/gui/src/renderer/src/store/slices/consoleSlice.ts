import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ScriptExecutionEvent, ScriptTestResult, SendResult } from '#/shared/types';

/**
 * A single entry in the global session console log.
 */
export interface ConsoleEntry {
  id: string;
  timestamp: number;
  requestName: string;
  collectionName?: string;
  result: SendResult;
  logs?: string[];
  tests?: ScriptTestResult[];
  /**
   * Ordered variable and flow-control activity from pre/post scripts for this send.
   */
  executionEvents?: ScriptExecutionEvent[];
  scriptError?: string;
}

export interface ConsoleState {
  consoleEntries: ConsoleEntry[];
}

const initialState: ConsoleState = {
  consoleEntries: []
};

const consoleSlice = createSlice({
  name: 'console',
  initialState,
  reducers: {
    /**
     * Prepends a send result entry to the session console.
     */
    addConsoleEntry(state, action: PayloadAction<ConsoleEntry>) {
      state.consoleEntries.unshift(action.payload);
    },
    /**
     * Removes all console entries.
     */
    clearConsole(state) {
      state.consoleEntries = [];
    }
  }
});

export const { addConsoleEntry, clearConsole } = consoleSlice.actions;
export default consoleSlice.reducer;
