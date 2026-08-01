/**
 * Public API for the HarborClient headless live-server host.
 */

export type { LiveServerHostProviders } from './providers.js';
/** Re-exported from core so Node hosts can keep a single live-server import. */
export { toLiveServerConfig, type ToLiveServerConfigInput } from '@harborclient/core/types';

export {
  clearLiveServerLogs,
  getLiveServerLogs,
  listRunningLiveServers,
  resolveLiveServerOrigin,
  resolveLiveServerOriginHost,
  setLiveServerFileChangedHandler,
  setLiveServerProcessLogHandler,
  setLiveServerRequestLogHandler,
  setLiveServerScriptLogHandler,
  setLiveServersChangedHandler,
  startLiveServer,
  stopAllLiveServers,
  stopLiveServer,
  updateLiveServerScripts
} from './liveServerHost.js';

export {
  clearAllLiveServerLogSessions,
  createLiveServerLogSession,
  freezeLiveServerLogSession,
  listLiveServerLogSessions,
  setLiveServerLogSessionsChangedHandler
} from './liveServerLogSessions.js';

export { createLiveServerApp } from './liveServerApp.js';
export type { CreateLiveServerAppOptions, LiveServerAccessLogFields } from './liveServerApp.js';

export { LIVE_SERVER_PORT_BASE, LIVE_SERVER_PORT_MAX, findFreePort, isPortFree } from './ports.js';
