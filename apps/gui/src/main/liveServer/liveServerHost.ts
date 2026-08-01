/**
 * GUI-facing live-server host: re-exports the shared package and wraps start
 * with Electron providers (snippets, Settings globals, SES script runner).
 */
import {
  startLiveServer as startLiveServerCore,
  type LiveServerHostProviders
} from '@harborclient/live-server';
import type { RunningLiveServer, StartLiveServerInput } from '@harborclient/core/types';
import { guiLiveServerProviders } from './guiLiveServerProviders';

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
  stopAllLiveServers,
  stopLiveServer,
  updateLiveServerScripts
} from '@harborclient/live-server';

export {
  clearAllLiveServerLogSessions,
  listLiveServerLogSessions,
  setLiveServerLogSessionsChangedHandler
} from '@harborclient/live-server';

/**
 * Starts a live server using GUI registry snippets, Settings globals, and the
 * Electron SES script runner.
 *
 * @param input - Runtime id (optional), saved id, and server config.
 * @param providers - Optional override (tests); defaults to GUI providers.
 * @returns The running instance including the assigned port and origin.
 */
export async function startLiveServer(
  input: StartLiveServerInput,
  providers: LiveServerHostProviders = guiLiveServerProviders
): Promise<RunningLiveServer> {
  return startLiveServerCore(input, providers);
}
