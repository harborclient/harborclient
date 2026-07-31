import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { LogsSelectionSnapshot } from '@harborclient/core/ai/scriptReferences';
import type { LiveServer, RunningLiveServer } from '@harborclient/core/types';
import type { RootState } from '#/renderer/src/store/redux';

/**
 * Redux state for saved and running live servers.
 */
export interface LiveServersState {
  /**
   * Saved live server configs from the local registry.
   */
  saved: LiveServer[];

  /**
   * Currently running live server instances.
   */
  running: RunningLiveServer[];

  /**
   * Browser tab ids opened for each running server instance id.
   */
  tabIdsByServerId: Record<string, string>;

  /**
   * Saved live server id whose Express logs the footer panel displays.
   */
  logsSavedId: number | null;

  /**
   * Access-log selection snapshots keyed by the full `@logs` reference token.
   */
  logsSelections: Record<string, LogsSelectionSnapshot>;
}

const initialState: LiveServersState = {
  saved: [],
  running: [],
  tabIdsByServerId: {},
  logsSavedId: null,
  logsSelections: {}
};

const liveServersSlice = createSlice({
  name: 'liveServers',
  initialState,
  reducers: {
    /**
     * Replaces the saved live server list after refresh or persistence.
     *
     * @param state - Live servers slice draft.
     * @param action - Saved servers from the registry.
     */
    setSavedLiveServers(state, action: PayloadAction<LiveServer[]>) {
      state.saved = action.payload;
    },

    /**
     * Replaces the running live server list after start/stop or a push event.
     *
     * @param state - Live servers slice draft.
     * @param action - Currently running instances.
     */
    setRunningLiveServers(state, action: PayloadAction<RunningLiveServer[]>) {
      state.running = action.payload;
      const runningIds = new Set(action.payload.map((server) => server.id));
      for (const id of Object.keys(state.tabIdsByServerId)) {
        if (!runningIds.has(id)) {
          delete state.tabIdsByServerId[id];
        }
      }
    },

    /**
     * Records which browser tab was opened for a running live server.
     *
     * @param state - Live servers slice draft.
     * @param action - Server instance id and browser tab id.
     */
    bindLiveServerTab(state, action: PayloadAction<{ serverId: string; tabId: string }>) {
      state.tabIdsByServerId[action.payload.serverId] = action.payload.tabId;
    },

    /**
     * Clears the browser tab binding for a stopped live server.
     *
     * @param state - Live servers slice draft.
     * @param action - Server instance id.
     */
    unbindLiveServerTab(state, action: PayloadAction<string>) {
      delete state.tabIdsByServerId[action.payload];
    },

    /**
     * Sets which saved live server the footer logs panel should display.
     *
     * @param state - Live servers slice draft.
     * @param action - Saved live server id, or null when none selected.
     */
    setLiveServerLogsSavedId(state, action: PayloadAction<number | null>) {
      state.logsSavedId = action.payload;
    },

    /**
     * Stores an access-log selection snapshot for an `@logs` reference token.
     *
     * @param state - Live servers slice draft.
     * @param action - Token and captured selection snapshot.
     */
    setLiveServerLogsSelection(
      state,
      action: PayloadAction<{ token: string; snapshot: LogsSelectionSnapshot }>
    ) {
      state.logsSelections[action.payload.token] = action.payload.snapshot;
    }
  }
});

export const {
  setSavedLiveServers,
  setRunningLiveServers,
  bindLiveServerTab,
  unbindLiveServerTab,
  setLiveServerLogsSavedId,
  setLiveServerLogsSelection
} = liveServersSlice.actions;

/**
 * Returns access-log selection snapshots keyed by `@logs` reference token.
 *
 * @param state - Redux root state.
 */
export const selectLiveServerLogsSelections = (
  state: RootState
): Record<string, LogsSelectionSnapshot> => state.liveServers.logsSelections;

export default liveServersSlice.reducer;
