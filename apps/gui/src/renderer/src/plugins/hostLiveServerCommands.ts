import type {
  CreateLiveServerInput,
  LiveServer,
  LiveServerConfig,
  LiveServerGetLogsQuery,
  LiveServerInstanceQuery,
  LiveServerLogsQuery,
  LiveServerRequestLogEntry,
  RunningLiveServer,
  StartLiveServerInput,
  UpdateLiveServerInput
} from '@harborclient/sdk';
import { normalizeLiveServerCorsSettings } from '@harborclient/core/types';
import { store } from '#/renderer/src/store/redux';
import {
  setRunningLiveServers,
  setSavedLiveServers
} from '#/renderer/src/store/slices/liveServersSlice';
import { toLiveServerConfig } from '#/renderer/src/store/thunks/liveServers';

/**
 * Default trailing log lines returned by {@link getLiveServerLogsForPlugin}.
 */
const DEFAULT_LIVE_SERVER_LOG_LIMIT = 100;

/**
 * Maximum trailing log lines returned by {@link getLiveServerLogsForPlugin}.
 */
const MAX_LIVE_SERVER_LOG_LIMIT = 1000;

/**
 * Builds a {@link LiveServerConfig} from a saved live server row.
 *
 * @param server - Saved registry row.
 * @returns Normalized config suitable for start.
 */
function configFromSaved(server: LiveServer): LiveServerConfig {
  return toLiveServerConfig({
    name: server.name,
    root: server.root,
    port: server.port,
    aliases: server.aliases,
    watch: server.watch,
    cors: server.cors,
    openPath: server.openPath,
    rememberLastUrl: server.rememberLastUrl,
    lastOpenedPath: server.lastOpenedPath,
    indexFiles: server.indexFiles,
    host: server.host,
    headers: server.headers,
    routes: server.routes,
    proxies: server.proxies,
    ssl: server.ssl,
    runCommand: server.runCommand,
    restartOnCrash: server.restartOnCrash,
    urlVariable: server.urlVariable
  });
}

/**
 * Finds a running instance matching a status/stop/logs query.
 *
 * @param running - Current running list.
 * @param query - Runtime id or saved id.
 * @returns Matching instance, or undefined.
 */
function findRunning(
  running: RunningLiveServer[],
  query: LiveServerInstanceQuery
): RunningLiveServer | undefined {
  if ('id' in query) {
    return running.find((item) => item.id === query.id);
  }
  return running.find((item) => item.savedId === query.savedId);
}

/**
 * Normalizes a plugin start payload into the IPC start input.
 *
 * When `savedId` is set and `config` is omitted, loads the saved row and builds
 * its config. Throws when neither a usable config nor a resolvable saved id is
 * available.
 *
 * @param input - Plugin start input.
 * @returns IPC start payload with a concrete config.
 */
async function resolveStartInput(input: StartLiveServerInput): Promise<{
  id?: string;
  savedId?: number | null;
  config: LiveServerConfig;
}> {
  if (input == null || typeof input !== 'object') {
    throw new Error('hc.liveServers.start requires an input object.');
  }

  const savedId =
    typeof input.savedId === 'number' && Number.isFinite(input.savedId) ? input.savedId : null;
  const runtimeId =
    typeof input.id === 'string' && input.id.trim() !== '' ? input.id.trim() : undefined;

  if (input.config != null && typeof input.config === 'object') {
    const config = toLiveServerConfig({
      name: String(input.config.name ?? ''),
      root: String(input.config.root ?? ''),
      port: input.config.port ?? null,
      aliases: Array.isArray(input.config.aliases) ? input.config.aliases : [],
      watch: input.config.watch !== false,
      cors: normalizeLiveServerCorsSettings(input.config.cors),
      openPath: input.config.openPath,
      rememberLastUrl: input.config.rememberLastUrl,
      lastOpenedPath: input.config.lastOpenedPath,
      indexFiles: input.config.indexFiles,
      host: input.config.host,
      headers: input.config.headers,
      routes: input.config.routes,
      proxies: input.config.proxies,
      ssl: input.config.ssl,
      runCommand: input.config.runCommand,
      restartOnCrash: input.config.restartOnCrash,
      urlVariable: input.config.urlVariable
    });
    if (!config.root.trim()) {
      throw new Error('hc.liveServers.start requires config.root when providing config.');
    }
    return { id: runtimeId, savedId, config };
  }

  if (savedId == null) {
    throw new Error('hc.liveServers.start requires savedId or config.');
  }

  const items = await window.api.listLiveServers();
  const saved = items.find((item) => item.id === savedId);
  if (saved == null) {
    throw new Error(`hc.liveServers.start: saved live server ${savedId} was not found.`);
  }
  return { id: runtimeId, savedId, config: configFromSaved(saved) };
}

/**
 * Clamps a requested log limit to the allowed range.
 *
 * @param limit - Optional caller limit.
 * @returns Effective limit between 1 and {@link MAX_LIVE_SERVER_LOG_LIMIT}.
 */
function resolveLogLimit(limit: number | undefined): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) {
    return DEFAULT_LIVE_SERVER_LOG_LIMIT;
  }
  return Math.min(Math.max(1, Math.floor(limit)), MAX_LIVE_SERVER_LOG_LIMIT);
}

/**
 * Lists all saved live servers from the local registry.
 *
 * @returns Saved live server rows.
 */
export async function listLiveServersForPlugin(): Promise<LiveServer[]> {
  const items = await window.api.listLiveServers();
  store.dispatch(setSavedLiveServers(items));
  return items;
}

/**
 * Returns one saved live server by database id or uuid.
 *
 * @param idOrUuid - Numeric id or uuid string.
 * @returns The saved server, or null when not found.
 */
export async function getLiveServerForPlugin(
  idOrUuid: number | string
): Promise<LiveServer | null> {
  const items = await listLiveServersForPlugin();
  if (typeof idOrUuid === 'number') {
    return items.find((item) => item.id === idOrUuid) ?? null;
  }
  const key = String(idOrUuid).trim();
  if (!key) {
    return null;
  }
  return items.find((item) => item.uuid === key || String(item.id) === key) ?? null;
}

/**
 * Creates a saved live server and returns the new row.
 *
 * @param input - Create payload.
 * @returns The created saved server.
 */
export async function createLiveServerForPlugin(input: CreateLiveServerInput): Promise<LiveServer> {
  const previousIds = new Set(store.getState().liveServers.saved.map((server) => server.id));
  const items = await window.api.createLiveServer(input);
  store.dispatch(setSavedLiveServers(items));
  const created = items.find((server) => !previousIds.has(server.id));
  if (created == null) {
    throw new Error('hc.liveServers.create failed to resolve the new server.');
  }
  return created;
}

/**
 * Updates a saved live server and returns the refreshed row.
 *
 * @param input - Full update payload including id.
 * @returns The updated saved server.
 */
export async function updateLiveServerForPlugin(input: UpdateLiveServerInput): Promise<LiveServer> {
  const items = await window.api.updateLiveServer(input);
  store.dispatch(setSavedLiveServers(items));
  const updated = items.find((server) => server.id === input.id);
  if (updated == null) {
    throw new Error(`hc.liveServers.update: live server ${input.id} was not found.`);
  }
  return updated;
}

/**
 * Deletes a saved live server.
 *
 * @param id - Database primary key.
 */
export async function deleteLiveServerForPlugin(id: number): Promise<void> {
  if (typeof id !== 'number' || !Number.isFinite(id)) {
    throw new Error('hc.liveServers.delete requires a numeric id.');
  }
  const items = await window.api.deleteLiveServer(id);
  store.dispatch(setSavedLiveServers(items));
}

/**
 * Starts a live server and syncs the running list into Redux.
 *
 * Does not open a browser tab.
 *
 * @param input - Saved id and/or config.
 * @returns The running instance.
 */
export async function startLiveServerForPlugin(
  input: StartLiveServerInput
): Promise<RunningLiveServer> {
  const startInput = await resolveStartInput(input);
  const running = await window.api.startLiveServer(startInput);
  const refreshed = await window.api.listRunningLiveServers();
  store.dispatch(setRunningLiveServers(refreshed));
  return running;
}

/**
 * Stops one running live server by runtime id or saved id.
 *
 * @param query - Runtime `id` or `savedId`.
 */
export async function stopLiveServerForPlugin(query: LiveServerInstanceQuery): Promise<void> {
  const running = await window.api.listRunningLiveServers();
  const match = findRunning(running, query);
  if (match == null) {
    if ('id' in query) {
      throw new Error(`hc.liveServers.stop: running instance ${query.id} was not found.`);
    }
    throw new Error(`hc.liveServers.stop: no running instance for savedId ${query.savedId}.`);
  }
  await window.api.stopLiveServer(match.id);
  const refreshed = await window.api.listRunningLiveServers();
  store.dispatch(setRunningLiveServers(refreshed));
}

/**
 * Lists currently running live server instances.
 *
 * @returns Running instances.
 */
export async function listRunningLiveServersForPlugin(): Promise<RunningLiveServer[]> {
  const running = await window.api.listRunningLiveServers();
  store.dispatch(setRunningLiveServers(running));
  return running;
}

/**
 * Returns the running status for one instance, or null when not running.
 *
 * @param query - Runtime `id` or `savedId`.
 * @returns The running instance, or null.
 */
export async function getLiveServerStatusForPlugin(
  query: LiveServerInstanceQuery
): Promise<RunningLiveServer | null> {
  const running = await listRunningLiveServersForPlugin();
  return findRunning(running, query) ?? null;
}

/**
 * Returns buffered Express request logs for a running live server.
 *
 * @param query - Runtime `id` or `savedId`, plus optional `limit`.
 * @returns Trailing access-log entries.
 */
export async function getLiveServerLogsForPlugin(
  query: LiveServerGetLogsQuery
): Promise<LiveServerRequestLogEntry[]> {
  const { limit, ...logsQuery } = query;
  const all = await window.api.getLiveServerLogs(logsQuery);
  const maxLines = resolveLogLimit(limit);
  return all.length > maxLines ? all.slice(all.length - maxLines) : all;
}

/**
 * Clears the in-memory request log buffer for a running live server.
 *
 * @param query - Runtime `id` or `savedId`.
 */
export async function clearLiveServerLogsForPlugin(query: LiveServerLogsQuery): Promise<void> {
  await window.api.clearLiveServerLogs(query);
}
