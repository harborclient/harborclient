import { createAsyncThunk } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import type {
  CreateLiveServerInput,
  LiveServer,
  LiveServerAlias,
  LiveServerConfig,
  LiveServerCorsSettings,
  RunningLiveServer,
  StartLiveServerInput,
  UpdateLiveServerInput
} from '@harborclient/core/types';
import { normalizeLiveServerCorsSettings } from '@harborclient/core/types';
import type { AppDispatch, RootState, ThunkApiConfig } from '#/renderer/src/store/redux';
import {
  bindLiveServerTab,
  setRunningLiveServers,
  setSavedLiveServers,
  unbindLiveServerTab
} from '#/renderer/src/store/slices/liveServersSlice';
import {
  openLiveServerModal,
  type LiveServerModalMode
} from '#/renderer/src/store/slices/modalsSlice';
import {
  setActivePluginFooterPanelId,
  setShowConsole,
  setShowLiveServerLogs,
  setShowMcp,
  setShowTerminal,
  setShowVariables
} from '#/renderer/src/store/slices/navigationSlice';
import { newBrowserTab, setActiveTab } from '#/renderer/src/store/slices/tabsSlice';
import { isBrowserTab } from '#/renderer/src/store/tabs';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/Modals/dialogHelpers';

/**
 * Payload for opening the live server create/edit footer panel.
 */
export type OpenLiveServerEditorInput = {
  mode: LiveServerModalMode;
  savedId?: number | null;
  name?: string;
  root?: string;
  port?: number | null;
  aliases?: LiveServerAlias[];
  watch?: boolean;
  cors?: LiveServerCorsSettings;
};

/**
 * Reloads saved live servers from the local registry into the store.
 */
export const refreshLiveServers = createAsyncThunk<void, void, ThunkApiConfig>(
  'liveServers/refreshSaved',
  async (_arg, { dispatch }) => {
    const items = await window.api.listLiveServers();
    dispatch(setSavedLiveServers(items));
  }
);

/**
 * Reloads running live server instances from the main process into the store.
 */
export const refreshRunningLiveServers = createAsyncThunk<void, void, ThunkApiConfig>(
  'liveServers/refreshRunning',
  async (_arg, { dispatch }) => {
    const running = await window.api.listRunningLiveServers();
    dispatch(setRunningLiveServers(running));
  }
);

/**
 * Builds a {@link LiveServerConfig} from saved or editor fields.
 *
 * @param input - Partial config fields.
 * @returns Normalized config suitable for start/save.
 */
export function toLiveServerConfig(input: {
  name: string;
  root: string;
  port: number | null;
  aliases: LiveServerConfig['aliases'];
  watch: boolean;
  cors?: LiveServerCorsSettings;
}): LiveServerConfig {
  return {
    name: input.name.trim() || 'Live Server',
    root: input.root.trim(),
    port: input.port,
    aliases: input.aliases,
    watch: input.watch,
    cors: normalizeLiveServerCorsSettings(input.cors)
  };
}

/**
 * Closes other footer panels, then opens the live server create/edit editor.
 *
 * Mutual exclusivity matches console/variables/MCP/terminal so drafts do not
 * stack under another slide-up panel.
 */
export const openLiveServerEditor = createAsyncThunk<
  void,
  OpenLiveServerEditorInput,
  ThunkApiConfig
>('liveServers/openEditor', async (payload, { dispatch }) => {
  dispatch(setShowConsole(false));
  dispatch(setShowVariables(false));
  dispatch(setShowMcp(false));
  dispatch(setShowTerminal(false));
  dispatch(setShowLiveServerLogs(false));
  dispatch(setActivePluginFooterPanelId(null));
  dispatch(openLiveServerModal(payload));
});

/**
 * Creates a saved live server, refreshes the list, and returns the new row.
 */
export const createSavedLiveServer = createAsyncThunk<
  LiveServer,
  CreateLiveServerInput,
  ThunkApiConfig
>('liveServers/createSaved', async (input, { dispatch, getState }) => {
  const previousIds = new Set(getState().liveServers.saved.map((server) => server.id));
  const items = await window.api.createLiveServer(input);
  dispatch(setSavedLiveServers(items));
  const created = items.find((server) => !previousIds.has(server.id));
  if (created == null) {
    throw new Error('Failed to create live server');
  }
  return created;
});

/**
 * Updates a saved live server and refreshes the list.
 */
export const updateSavedLiveServer = createAsyncThunk<void, UpdateLiveServerInput, ThunkApiConfig>(
  'liveServers/updateSaved',
  async (input, { dispatch }) => {
    const items = await window.api.updateLiveServer(input);
    dispatch(setSavedLiveServers(items));
  }
);

/**
 * Deletes a saved live server and refreshes the list.
 */
export const deleteSavedLiveServer = createAsyncThunk<void, number, ThunkApiConfig>(
  'liveServers/deleteSaved',
  async (id, { dispatch }) => {
    const items = await window.api.deleteLiveServer(id);
    dispatch(setSavedLiveServers(items));
  }
);

/**
 * Thunk argument for starting a live server, with optional browser-tab open.
 */
export type StartLiveServerThunkArg = StartLiveServerInput & {
  /**
   * When true (default), opens a browser tab at the server origin after start.
   */
  openBrowser?: boolean;
};

/**
 * Starts a live server, optionally opens a browser tab at its origin, and tracks the binding.
 */
export const startLiveServer = createAsyncThunk<
  RunningLiveServer,
  StartLiveServerThunkArg,
  ThunkApiConfig
>('liveServers/start', async (input, { dispatch }) => {
  const { openBrowser = true, ...startInput } = input;
  const running = await window.api.startLiveServer(startInput);
  const refreshed = await window.api.listRunningLiveServers();
  dispatch(setRunningLiveServers(refreshed));

  if (openBrowser) {
    const tabId = crypto.randomUUID();
    dispatch(
      newBrowserTab({
        tabId,
        url: running.origin,
        homeUrl: running.origin
      })
    );
    dispatch(bindLiveServerTab({ serverId: running.id, tabId }));
  }
  return running;
});

/**
 * Stops a running live server by runtime instance id.
 */
export const stopLiveServer = createAsyncThunk<void, string, ThunkApiConfig>(
  'liveServers/stop',
  async (id, { dispatch }) => {
    await window.api.stopLiveServer(id);
    dispatch(unbindLiveServerTab(id));
    const refreshed = await window.api.listRunningLiveServers();
    dispatch(setRunningLiveServers(refreshed));
  }
);

/**
 * Opens (or focuses) a browser tab for a running live server origin.
 *
 * Prefers an existing browser tab whose URL is on the same origin; otherwise
 * opens a new Live Page pointed at the server root.
 *
 * @param origin - Server origin such as `http://127.0.0.1:5500`.
 * @param serverId - Optional runtime id used to record the tab binding.
 * @returns Thunk that opens or focuses a browser tab.
 */
export function openLiveServerInBrowser(
  origin: string,
  serverId?: string
): (dispatch: AppDispatch, getState: () => RootState) => void {
  return (dispatch, getState) => {
    const state = getState();

    if (serverId) {
      const boundTabId = state.liveServers.tabIdsByServerId[serverId];
      if (boundTabId) {
        const bound = state.tabs.tabs.find((tab) => tab.tabId === boundTabId);
        if (bound && isBrowserTab(bound)) {
          dispatch(setActiveTab(boundTabId));
          return;
        }
      }
    }

    const matching = state.tabs.tabs.find((tab) => {
      if (!isBrowserTab(tab)) {
        return false;
      }
      try {
        return new URL(tab.url).origin === origin;
      } catch {
        return false;
      }
    });

    if (matching) {
      dispatch(setActiveTab(matching.tabId));
      if (serverId) {
        dispatch(bindLiveServerTab({ serverId, tabId: matching.tabId }));
      }
      return;
    }

    const tabId = crypto.randomUUID();
    dispatch(newBrowserTab({ tabId, url: origin, homeUrl: origin }));
    if (serverId) {
      dispatch(bindLiveServerTab({ serverId, tabId }));
    }
  };
}

/**
 * Reloads browser tabs whose URL origin matches a live server that changed.
 *
 * @param origin - Origin of the changed live server.
 * @returns Thunk that calls `browserReload` for matching tabs.
 */
export function reloadBrowserTabsForLiveServerOrigin(
  origin: string
): (_dispatch: AppDispatch, getState: () => RootState) => void {
  return (_dispatch, getState) => {
    const tabs = getState().tabs.tabs;
    for (const tab of tabs) {
      if (!isBrowserTab(tab)) {
        continue;
      }
      try {
        if (new URL(tab.url).origin === origin) {
          void window.api.browserReload(tab.tabId);
        }
      } catch {
        // Ignore invalid tab URLs.
      }
    }
  };
}

/**
 * Shows a user-facing alert for a live-server operation failure.
 *
 * @param dispatch - App dispatch.
 * @param error - Caught error.
 * @param fallback - Fallback message when the error has no message.
 */
export function reportLiveServerError(
  dispatch: AppDispatch,
  error: unknown,
  fallback: string
): void {
  showAlert(dispatch, formatErrorMessage(error, fallback));
  toast.error(formatErrorMessage(error, fallback));
}
