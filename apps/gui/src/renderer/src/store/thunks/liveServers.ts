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
import {
  liveServerOpenedPathFromUrl,
  normalizeLiveServerConfigFields,
  normalizeLiveServerCorsSettings,
  resolveLiveServerHomeUrl,
  resolveLiveServerOpenUrl
} from '@harborclient/core/types';
import type { AppDispatch, RootState, ThunkApiConfig } from '#/renderer/src/store/redux';
import {
  bindLiveServerTab,
  setRunningLiveServers,
  setSavedLiveServers,
  unbindLiveServerTab
} from '#/renderer/src/store/slices/liveServersSlice';
import {
  openLiveServerModal,
  setLiveServerModalLastOpenedPath,
  type LiveServerModalMode
} from '#/renderer/src/store/slices/modalsSlice';
import { setGlobalVariable } from '#/renderer/src/plugins/hostGlobalsCommands';
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
 * Debounce window for persisting {@link LiveServer.lastOpenedPath} so rapid
 * in-app navigations do not thrash SQLite.
 */
const LAST_OPENED_PATH_DEBOUNCE_MS = 400;

/**
 * Pending debounce timers keyed by saved live server id.
 */
const lastOpenedPathPersistTimers = new Map<number, ReturnType<typeof setTimeout>>();

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
  openPath?: string;
  rememberLastUrl?: boolean;
  lastOpenedPath?: string | null;
  /**
   * Comma-separated index filenames for the General tab editor field.
   */
  indexFiles?: string;
  host?: string;
  /**
   * Custom response headers for the Headers tab.
   */
  headers?: LiveServerConfig['headers'];
  /**
   * Path routing rules for the Routing tab.
   */
  routes?: LiveServerConfig['routes'];
  /**
   * Reverse-proxy rules for the Proxy tab.
   */
  proxies?: LiveServerConfig['proxies'];
  /**
   * TLS settings for the SSL tab.
   */
  ssl?: LiveServerConfig['ssl'];
  /**
   * Companion process command (absolute binary + args).
   */
  runCommand?: string;
  /**
   * When true, restart the companion after an unexpected crash.
   */
  restartOnCrash?: boolean;
  /**
   * Global variable name set to the server origin URL on start.
   */
  urlVariable?: string;
};

/**
 * Formats an index-files array as a comma-separated string for the editor.
 *
 * @param files - Normalized index filenames from a saved config.
 * @returns Editor-friendly comma-separated string.
 */
export function formatLiveServerIndexFilesInput(files: string[]): string {
  return files.join(', ');
}

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
 * Expanded fields (`openPath`, `host`, `headers`, `ssl`, …) are optional on
 * the input and filled via {@link normalizeLiveServerConfigFields} so callers
 * that predate those settings still produce a complete config. `indexFiles`
 * may be a `string[]` or a comma-separated editor string.
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
  openPath?: string;
  rememberLastUrl?: boolean;
  lastOpenedPath?: string | null;
  indexFiles?: string | string[];
  host?: string;
  headers?: LiveServerConfig['headers'];
  routes?: LiveServerConfig['routes'];
  proxies?: LiveServerConfig['proxies'];
  ssl?: LiveServerConfig['ssl'];
  runCommand?: string;
  restartOnCrash?: boolean;
  urlVariable?: string;
}): LiveServerConfig {
  const fields = normalizeLiveServerConfigFields(input);
  return {
    name: input.name.trim() || 'Live Server',
    root: input.root.trim(),
    port: input.port,
    aliases: input.aliases,
    watch: input.watch,
    cors: normalizeLiveServerCorsSettings(input.cors),
    ...fields
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
 * Starts a live server, optionally opens a browser tab, and tracks the binding.
 *
 * When `openBrowser` is true, the tab’s initial `url` is
 * {@link resolveLiveServerOpenUrl} (honors remember-last-URL). `homeUrl` is
 * always `origin + openPath` so the address-bar Home control returns to the
 * configured entry, not a remembered deep link.
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

  const urlVariable = running.config.urlVariable.trim();
  if (urlVariable !== '') {
    await setGlobalVariable(urlVariable, running.origin);
  }

  if (openBrowser) {
    const tabId = crypto.randomUUID();
    dispatch(
      newBrowserTab({
        tabId,
        url: resolveLiveServerOpenUrl(running.origin, running.config),
        homeUrl: resolveLiveServerHomeUrl(running.origin, running.config.openPath)
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
 * Returns whether draft settings that are baked into the Express app / listen
 * differ from a running instance’s start-time config snapshot.
 *
 * Display-only and open-URL fields (`name`, `openPath`, `rememberLastUrl`,
 * `lastOpenedPath`) are ignored — changing them does not require a restart to
 * affect serving. Both sides are normalized via {@link toLiveServerConfig}
 * before compare so empty vs default does not false-positive.
 *
 * @param draft - Editor or saved config the user wants applied.
 * @param running - Config snapshot from the currently running instance.
 * @returns True when Stop+Start (or Restart) is needed for the draft to take effect.
 */
export function liveServerRuntimeConfigNeedsRestart(
  draft: LiveServerConfig,
  running: LiveServerConfig
): boolean {
  const next = toLiveServerConfig(draft);
  const current = toLiveServerConfig(running);
  return (
    next.root !== current.root ||
    next.port !== current.port ||
    next.host !== current.host ||
    next.watch !== current.watch ||
    JSON.stringify(next.aliases) !== JSON.stringify(current.aliases) ||
    JSON.stringify(next.cors) !== JSON.stringify(current.cors) ||
    JSON.stringify(next.indexFiles) !== JSON.stringify(current.indexFiles) ||
    JSON.stringify(next.headers) !== JSON.stringify(current.headers) ||
    JSON.stringify(next.routes) !== JSON.stringify(current.routes) ||
    JSON.stringify(next.proxies) !== JSON.stringify(current.proxies) ||
    JSON.stringify(next.ssl) !== JSON.stringify(current.ssl) ||
    next.runCommand !== current.runCommand ||
    next.restartOnCrash !== current.restartOnCrash
  );
}

/**
 * Opens (or focuses) a browser tab for a running live server origin.
 *
 * Prefers an existing bound tab, then any browser tab on the same origin —
 * focusing those does **not** force navigation (preserves the user’s place).
 * When opening a **new** tab, resolves the initial URL via
 * {@link resolveLiveServerOpenUrl} using the running instance config (or an
 * optional override). `homeUrl` is always `origin + openPath`.
 *
 * @param origin - Server origin such as `http://127.0.0.1:5500`.
 * @param serverId - Optional runtime id used to record the tab binding.
 * @param openConfig - Optional open-path fields; defaults to the running
 *   instance config when `serverId` matches a running server.
 * @returns Thunk that opens or focuses a browser tab.
 */
export function openLiveServerInBrowser(
  origin: string,
  serverId?: string,
  openConfig?: Pick<LiveServerConfig, 'openPath' | 'rememberLastUrl' | 'lastOpenedPath'>
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

    const running =
      serverId != null
        ? state.liveServers.running.find((instance) => instance.id === serverId)
        : undefined;
    const config = openConfig ?? running?.config;
    const url = config != null ? resolveLiveServerOpenUrl(origin, config) : origin;
    const homeUrl = config != null ? resolveLiveServerHomeUrl(origin, config.openPath) : origin;

    const tabId = crypto.randomUUID();
    dispatch(newBrowserTab({ tabId, url, homeUrl }));
    if (serverId) {
      dispatch(bindLiveServerTab({ serverId, tabId }));
    }
  };
}

/**
 * Arguments for {@link restartLiveServer}: stop a runtime instance, then start
 * again with the given config without opening a duplicate Live Page by default.
 */
export type RestartLiveServerThunkArg = {
  /**
   * Runtime instance id to stop before starting again.
   */
  runtimeId: string;

  /**
   * Saved registry id to attach to the new instance, when known.
   */
  savedId?: number | null;

  /**
   * Config applied on the new start (Express middleware / listen snapshot).
   */
  config: LiveServerConfig;
};

/**
 * Stops a running live server and starts it again with a new config snapshot.
 *
 * Uses `openBrowser: false` on start, then focuses or rebinds an existing Live
 * Page via {@link openLiveServerInBrowser} so restart does not spawn a
 * duplicate tab when one already exists for the origin.
 *
 * @param input - Runtime id to stop plus config (and optional saved id) for start.
 * @returns The new running instance.
 */
export const restartLiveServer = createAsyncThunk<
  RunningLiveServer,
  RestartLiveServerThunkArg,
  ThunkApiConfig
>('liveServers/restart', async (input, { dispatch }) => {
  await dispatch(stopLiveServer(input.runtimeId)).unwrap();
  const running = await dispatch(
    startLiveServer({
      savedId: input.savedId ?? undefined,
      config: input.config,
      openBrowser: false
    })
  ).unwrap();
  (dispatch as AppDispatch)(
    openLiveServerInBrowser(running.origin, running.id, {
      openPath: running.config.openPath,
      rememberLastUrl: running.config.rememberLastUrl,
      lastOpenedPath: running.config.lastOpenedPath
    })
  );
  return running;
});

/**
 * Decision input for whether a browser navigation should update a saved
 * server’s {@link LiveServer.lastOpenedPath}.
 */
export type LiveServerLastOpenedPersistCandidate = {
  /**
   * Browser tab id that navigated.
   */
  tabId: string;

  /**
   * Full URL after navigation.
   */
  url: string;

  /**
   * Bound browser tabs keyed by running server instance id.
   */
  tabIdsByServerId: Record<string, string>;

  /**
   * Currently running live server instances.
   */
  running: RunningLiveServer[];

  /**
   * Saved live server rows from the registry.
   */
  saved: LiveServer[];
};

/**
 * Result of {@link resolveLiveServerLastOpenedPersist} when a write is needed.
 */
export type LiveServerLastOpenedPersistTarget = {
  /**
   * Saved `live_servers.id` to update.
   */
  savedId: number;

  /**
   * Path+search+hash to persist.
   */
  lastOpenedPath: string;
};

/**
 * Pure helper: decides whether a navigation should update `lastOpenedPath`.
 *
 * Requires a bound tab, a running instance with `savedId`, matching origin,
 * and `rememberLastUrl` on the **saved** row. Skips when the path is unchanged.
 *
 * @param input - Navigation + live-server state snapshot.
 * @returns Persist target, or null when no write is needed.
 */
export function resolveLiveServerLastOpenedPersist(
  input: LiveServerLastOpenedPersistCandidate
): LiveServerLastOpenedPersistTarget | null {
  const serverId = Object.entries(input.tabIdsByServerId).find(
    ([, boundTabId]) => boundTabId === input.tabId
  )?.[0];
  if (serverId == null) {
    return null;
  }

  const running = input.running.find((instance) => instance.id === serverId);
  if (running == null || running.savedId == null) {
    return null;
  }

  const saved = input.saved.find((server) => server.id === running.savedId);
  if (saved == null || !saved.rememberLastUrl) {
    return null;
  }

  const path = liveServerOpenedPathFromUrl(input.url, running.origin);
  if (path == null || path === saved.lastOpenedPath) {
    return null;
  }

  return { savedId: saved.id, lastOpenedPath: path };
}

/**
 * Persists `lastOpenedPath` on a saved live server without changing other fields.
 *
 * @param input - Saved id and path fragment to store.
 */
export const persistLiveServerLastOpenedPath = createAsyncThunk<
  void,
  LiveServerLastOpenedPersistTarget,
  ThunkApiConfig
>('liveServers/persistLastOpenedPath', async (input, { dispatch, getState }) => {
  const saved = getState().liveServers.saved.find((server) => server.id === input.savedId);
  if (saved == null || !saved.rememberLastUrl) {
    return;
  }
  if (saved.lastOpenedPath === input.lastOpenedPath) {
    return;
  }

  await dispatch(
    updateSavedLiveServer({
      id: saved.id,
      name: saved.name,
      root: saved.root,
      port: saved.port,
      aliases: saved.aliases,
      watch: saved.watch,
      cors: saved.cors,
      openPath: saved.openPath,
      rememberLastUrl: saved.rememberLastUrl,
      lastOpenedPath: input.lastOpenedPath,
      indexFiles: saved.indexFiles,
      host: saved.host,
      headers: saved.headers,
      routes: saved.routes,
      proxies: saved.proxies,
      ssl: saved.ssl,
      runCommand: saved.runCommand,
      restartOnCrash: saved.restartOnCrash,
      urlVariable: saved.urlVariable
    })
  ).unwrap();

  const modal = getState().modals.liveServerModal;
  if (modal != null && modal.savedId === input.savedId) {
    dispatch(setLiveServerModalLastOpenedPath(input.lastOpenedPath));
  }
});

/**
 * Debounces and schedules a `lastOpenedPath` persist for a saved live server.
 *
 * @param dispatch - App dispatch.
 * @param target - Saved id and path to write after the debounce window.
 */
export function schedulePersistLiveServerLastOpenedPath(
  dispatch: AppDispatch,
  target: LiveServerLastOpenedPersistTarget
): void {
  const existing = lastOpenedPathPersistTimers.get(target.savedId);
  if (existing != null) {
    clearTimeout(existing);
  }
  const timer = setTimeout(() => {
    lastOpenedPathPersistTimers.delete(target.savedId);
    void dispatch(persistLiveServerLastOpenedPath(target));
  }, LAST_OPENED_PATH_DEBOUNCE_MS);
  lastOpenedPathPersistTimers.set(target.savedId, timer);
}

/**
 * After a Live Page navigation, optionally persists `lastOpenedPath` for the
 * bound saved live server when “Remember last URL” is enabled.
 *
 * @param tabId - Browser tab that navigated.
 * @param url - Full URL after navigation.
 * @returns Thunk that may schedule a debounced persist.
 */
export function maybePersistLiveServerLastOpenedFromNavigation(
  tabId: string,
  url: string
): (dispatch: AppDispatch, getState: () => RootState) => void {
  return (dispatch, getState) => {
    const state = getState();
    const target = resolveLiveServerLastOpenedPersist({
      tabId,
      url,
      tabIdsByServerId: state.liveServers.tabIdsByServerId,
      running: state.liveServers.running,
      saved: state.liveServers.saved
    });
    if (target == null) {
      return;
    }
    schedulePersistLiveServerLastOpenedPath(dispatch, target);
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
