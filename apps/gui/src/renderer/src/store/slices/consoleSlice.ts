import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type {
  ScriptExecutionEvent,
  ScriptRunError,
  ScriptTestResult,
  SendResult
} from '@harborclient/core/types';

/**
 * A single entry in the global session console log.
 */
export interface ConsoleEntry {
  id: string;
  timestamp: number;
  requestName: string;
  collectionName?: string;
  /**
   * Request tab that produced this send; used for jump-to-editor when still open.
   */
  requestTabId?: string;
  result: SendResult;
  logs?: string[];
  tests?: ScriptTestResult[];
  /**
   * Ordered variable and flow-control activity from pre/post scripts for this send.
   */
  executionEvents?: ScriptExecutionEvent[];
  scriptError?: string;
  /**
   * Structured script failures with slot metadata and mapped locations,
   * used for jump-to-editor from the console Output section.
   */
  scriptErrors?: ScriptRunError[];
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
