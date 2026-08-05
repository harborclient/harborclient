import { BrowserWindow } from 'electron';
import type {
  LiveServerFileChangedEvent,
  LiveServerLogSession,
  LiveServerProcessLogEntry,
  LiveServerRequestLogEntry,
  LiveServerScriptLogEntry,
  RunningLiveServer
} from '@harborclient/core/types';
import { readHarborclientExport } from '@harborclient/core/harborclientExport';
import { getRegisteredMainWindow } from '#/main/window/mainWindowReveal';
import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import type { IStorage } from '#/main/storage/IStorage';
import { RoutingStorage } from '#/main/storage/RoutingStorage';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import {
  clearLiveServerLogs,
  getLiveServerLogs,
  listRunningLiveServers,
  setLiveServerFileChangedHandler,
  setLiveServerProcessLogHandler,
  setLiveServerRequestLogHandler,
  setLiveServerScriptLogHandler,
  setLiveServersChangedHandler,
  startLiveServer,
  stopLiveServer,
  updateLiveServerScripts
} from '#/main/liveServer/liveServerHost';
import {
  clearAllLiveServerLogSessions,
  listLiveServerLogSessions,
  setLiveServerLogSessionsChangedHandler
} from '#/main/liveServer/liveServerLogSessions';
import { registerFilePathKnownRootProvider } from '#/main/ipc/handlers/filePathAccess';
import { openImportFile } from './importDialogs';
import { importLiveServerData } from './liveServerImport';

/**
 * Cached document roots from the last live-server list/create/update response.
 *
 * Team Hub / routed providers are async, so roots are refreshed whenever the
 * handler returns a list and exposed to file IPC via a known-root provider.
 */
let cachedLiveServerRoots: string[] = [];

/**
 * Remembers live-server document roots for filesystem IPC allowlisting.
 *
 * @param servers - Latest live-server configs from storage.
 */
function rememberLiveServerRoots(servers: Array<{ root?: string }>): void {
  cachedLiveServerRoots = servers
    .map((server) => (typeof server.root === 'string' ? server.root.trim() : ''))
    .filter((root) => root.length > 0);
}

/**
 * Sends a payload to the main window renderer when it is available.
 *
 * @param channel - IPC channel name.
 * @param payload - Event payload.
 */
function sendToMainWindow(channel: string, payload: unknown): void {
  const window = getRegisteredMainWindow();
  if (!window || window.isDestroyed()) {
    return;
  }
  window.webContents.send(channel, payload);
}

/**
 * Registers IPC handlers for live server runtime control and routed saved configs.
 *
 * @param db - Active storage facade used for provider-backed live servers.
 */
export function registerLiveServerHandlers(db: IStorage): void {
  registerFilePathKnownRootProvider(() => cachedLiveServerRoots);

  setLiveServerFileChangedHandler((event: LiveServerFileChangedEvent) => {
    sendToMainWindow('liveServer:file-changed', event);
  });

  setLiveServersChangedHandler((running: RunningLiveServer[]) => {
    sendToMainWindow('liveServers:changed', running);
  });

  setLiveServerLogSessionsChangedHandler((sessions: LiveServerLogSession[]) => {
    sendToMainWindow('liveServer:log-sessions-changed', sessions);
  });

  setLiveServerRequestLogHandler((entry: LiveServerRequestLogEntry) => {
    sendToMainWindow('liveServer:request-log', entry);
  });

  setLiveServerScriptLogHandler((entry: LiveServerScriptLogEntry) => {
    sendToMainWindow('liveServer:script-log', entry);
  });

  setLiveServerProcessLogHandler((entry: LiveServerProcessLogEntry) => {
    sendToMainWindow('liveServer:process-log', entry);
  });

  handle('liveServer:start', ipcArgSchemas.liveServerStart, (_event, input) =>
    startLiveServer(input)
  );

  handle('liveServer:stop', ipcArgSchemas.liveServerStop, (_event, id) => stopLiveServer(id));

  handle('liveServer:listRunning', ipcArgSchemas.none, () => listRunningLiveServers());

  handle('liveServer:listLogSessions', ipcArgSchemas.none, () => listLiveServerLogSessions());

  handle('liveServer:clearAllLogSessions', ipcArgSchemas.none, () => {
    clearAllLiveServerLogSessions();
  });

  handle('liveServer:getLogs', ipcArgSchemas.liveServerLogsQuery, (_event, query) =>
    getLiveServerLogs(query)
  );

  handle('liveServer:clearLogs', ipcArgSchemas.liveServerLogsQuery, (_event, query) => {
    clearLiveServerLogs(query);
  });

  handle('liveServers:list', ipcArgSchemas.none, async () => {
    const list =
      db instanceof RoutingStorage
        ? await db.listLiveServers()
        : getLocalDatabase().listLiveServers();
    rememberLiveServerRoots(list);
    return list;
  });

  handle('liveServers:create', ipcArgSchemas.liveServersCreate, async (_event, input) => {
    const list =
      db instanceof RoutingStorage
        ? await db.createLiveServer(input).then(() => db.listLiveServers())
        : getLocalDatabase().createLiveServer(input);
    rememberLiveServerRoots(list);
    return list;
  });

  handle('liveServers:update', ipcArgSchemas.liveServersUpdate, async (_event, input) => {
    const list =
      db instanceof RoutingStorage
        ? await db.updateLiveServer(input).then(() => db.listLiveServers())
        : getLocalDatabase().updateLiveServer(input);
    updateLiveServerScripts(input.id, {
      preRequestScripts: input.preRequestScripts,
      postRequestScripts: input.postRequestScripts
    });
    rememberLiveServerRoots(list);
    return list;
  });

  handle('liveServers:delete', ipcArgSchemas.liveServersDelete, async (_event, id) => {
    const list =
      db instanceof RoutingStorage
        ? await db.deleteLiveServer(id).then(() => db.listLiveServers())
        : getLocalDatabase().deleteLiveServer(id);
    rememberLiveServerRoots(list);
    return list;
  });

  handle(
    'liveServers:move',
    ipcArgSchemas.liveServersMove,
    async (_event, id, targetConnectionId) => {
      if (!(db instanceof RoutingStorage)) {
        throw new Error('Live server move is unavailable.');
      }
      const list = await db.moveLiveServer(id, targetConnectionId).then(() => db.listLiveServers());
      rememberLiveServerRoots(list);
      return list;
    }
  );

  handle(
    'liveServers:setLastOpenedPath',
    ipcArgSchemas.liveServersSetLastOpenedPath,
    (_event, id, path) => {
      if (!(db instanceof RoutingStorage)) {
        throw new Error('Live server path persistence is unavailable.');
      }
      db.setLiveServerLastOpenedPath(id, path);
    }
  );

  // Imports a HarborClient live-server export from a file selected via a native dialog.
  handle('liveServers:import', ipcArgSchemas.none, async () => {
    const win = BrowserWindow.getFocusedWindow();
    const file = await openImportFile(win);
    if (!file) {
      return null;
    }

    if (file.parsed == null || readHarborclientExport(file.parsed) !== 'server') {
      throw new Error('Selected file is not a HarborClient live server export.');
    }

    const result = await importLiveServerData(file.parsed, db);
    if (!result) {
      throw new Error('Failed to import live server export.');
    }

    return result;
  });
}
