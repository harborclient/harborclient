import type {
  LiveServerFileChangedEvent,
  LiveServerRequestLogEntry,
  RunningLiveServer
} from '@harborclient/core/types';
import { getRegisteredMainWindow } from '#/main/window/mainWindowReveal';
import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import {
  clearLiveServerLogs,
  getLiveServerLogs,
  listRunningLiveServers,
  setLiveServerFileChangedHandler,
  setLiveServerRequestLogHandler,
  setLiveServersChangedHandler,
  startLiveServer,
  stopLiveServer
} from '#/main/liveServer/liveServerHost';

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
 * Registers IPC handlers for live server runtime control and saved configs.
 */
export function registerLiveServerHandlers(): void {
  setLiveServerFileChangedHandler((event: LiveServerFileChangedEvent) => {
    sendToMainWindow('liveServer:file-changed', event);
  });

  setLiveServersChangedHandler((running: RunningLiveServer[]) => {
    sendToMainWindow('liveServers:changed', running);
  });

  setLiveServerRequestLogHandler((entry: LiveServerRequestLogEntry) => {
    sendToMainWindow('liveServer:request-log', entry);
  });

  handle('liveServer:start', ipcArgSchemas.liveServerStart, (_event, input) =>
    startLiveServer(input)
  );

  handle('liveServer:stop', ipcArgSchemas.liveServerStop, (_event, id) => stopLiveServer(id));

  handle('liveServer:listRunning', ipcArgSchemas.none, () => listRunningLiveServers());

  handle('liveServer:getLogs', ipcArgSchemas.liveServerLogsQuery, (_event, query) =>
    getLiveServerLogs(query)
  );

  handle('liveServer:clearLogs', ipcArgSchemas.liveServerLogsQuery, (_event, query) => {
    clearLiveServerLogs(query);
  });

  handle('liveServers:list', ipcArgSchemas.none, () => getLocalDatabase().listLiveServers());

  handle('liveServers:create', ipcArgSchemas.liveServersCreate, (_event, input) =>
    getLocalDatabase().createLiveServer(input)
  );

  handle('liveServers:update', ipcArgSchemas.liveServersUpdate, (_event, input) =>
    getLocalDatabase().updateLiveServer(input)
  );

  handle('liveServers:delete', ipcArgSchemas.liveServersDelete, (_event, id) =>
    getLocalDatabase().deleteLiveServer(id)
  );
}
