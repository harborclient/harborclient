import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import type {
  LiveServerConfig,
  LiveServerFileChangedEvent,
  LiveServerLogsQuery,
  LiveServerRequestLogEntry,
  RunningLiveServer,
  StartLiveServerInput
} from '@harborclient/core/types';
import { normalizeLiveServerCorsSettings } from '@harborclient/core/types';
import { createLiveServerApp } from './liveServerApp';
import { pushLiveServerLog } from './liveServerLogBuffer';
import { findFreePort } from './ports';
import { startLiveServerWatcher, type LiveServerWatcherHandle } from './liveServerWatcher';

/** HTTP server instance returned by {@link Express.listen}. */
type ExpressListenServer = ReturnType<Express['listen']>;

interface LiveServerEntry {
  server: ExpressListenServer;
  running: RunningLiveServer;
  watcher: LiveServerWatcherHandle | null;
  /**
   * Ring-buffered Express access logs for this instance.
   */
  logs: LiveServerRequestLogEntry[];
}

const servers = new Map<string, LiveServerEntry>();

type FileChangedHandler = (event: LiveServerFileChangedEvent) => void;
type ServersChangedHandler = (running: RunningLiveServer[]) => void;
type RequestLogHandler = (entry: LiveServerRequestLogEntry) => void;

let fileChangedHandler: FileChangedHandler | null = null;
let serversChangedHandler: ServersChangedHandler | null = null;
let requestLogHandler: RequestLogHandler | null = null;

/**
 * Registers the callback used when a watched live server detects a file change.
 *
 * @param handler - Receives the change event, or null to clear.
 */
export function setLiveServerFileChangedHandler(handler: FileChangedHandler | null): void {
  fileChangedHandler = handler;
}

/**
 * Registers the callback used when the running live-server list changes.
 *
 * @param handler - Receives the refreshed list, or null to clear.
 */
export function setLiveServersChangedHandler(handler: ServersChangedHandler | null): void {
  serversChangedHandler = handler;
}

/**
 * Registers the callback used when a live server finishes serving a request.
 *
 * @param handler - Receives each access-log entry, or null to clear.
 */
export function setLiveServerRequestLogHandler(handler: RequestLogHandler | null): void {
  requestLogHandler = handler;
}

/**
 * Notifies subscribers that the running list changed.
 */
function emitServersChanged(): void {
  serversChangedHandler?.(listRunningLiveServers());
}

/**
 * Finds a running entry by saved id or runtime instance id.
 *
 * @param query - Saved id or runtime id.
 * @returns Matching entry, or undefined when not running.
 */
function findEntry(query: LiveServerLogsQuery): LiveServerEntry | undefined {
  if ('id' in query) {
    return servers.get(query.id);
  }
  for (const entry of servers.values()) {
    if (entry.running.savedId === query.savedId) {
      return entry;
    }
  }
  return undefined;
}

/**
 * Returns a snapshot of buffered Express request logs for a running instance.
 *
 * @param query - Saved id or runtime instance id.
 * @returns Recent access-log entries, or an empty array when not running.
 */
export function getLiveServerLogs(query: LiveServerLogsQuery): LiveServerRequestLogEntry[] {
  const entry = findEntry(query);
  return entry != null ? [...entry.logs] : [];
}

/**
 * Clears the in-memory request log buffer for a running instance.
 *
 * No-op when the queried server is not running.
 *
 * @param query - Saved id or runtime instance id.
 */
export function clearLiveServerLogs(query: LiveServerLogsQuery): void {
  const entry = findEntry(query);
  if (entry == null) {
    return;
  }
  entry.logs.length = 0;
}

/**
 * Normalizes a start config (trims strings, drops empty aliases).
 *
 * @param config - Raw config from the renderer.
 * @returns Normalized config.
 */
function normalizeConfig(config: LiveServerConfig): LiveServerConfig {
  return {
    name: config.name.trim() || 'Live Server',
    root: config.root.trim(),
    port: config.port,
    aliases: (config.aliases ?? [])
      .map((alias) => ({
        path: alias.path.trim(),
        target: alias.target.trim()
      }))
      .filter((alias) => alias.path !== '' && alias.target !== ''),
    watch: config.watch !== false,
    cors: normalizeLiveServerCorsSettings(config.cors)
  };
}

/**
 * Starts a live server instance.
 *
 * Binds to loopback (`127.0.0.1`) only. When `config.port` is null, the next
 * free port from 5500 upward is chosen. An explicit busy port rejects.
 *
 * @param input - Runtime id (optional), saved id, and server config.
 * @returns The running instance including the assigned port and origin.
 */
export async function startLiveServer(input: StartLiveServerInput): Promise<RunningLiveServer> {
  const config = normalizeConfig(input.config);
  if (!config.root) {
    throw new Error('Root directory is required');
  }

  const id = input.id?.trim() || randomUUID();
  const savedId = input.savedId ?? null;
  await stopLiveServer(id);

  const logs: LiveServerRequestLogEntry[] = [];
  const port = await findFreePort(config.port);
  const app = createLiveServerApp(config.root, config.aliases, config.cors, (fields) => {
    const entry: LiveServerRequestLogEntry = {
      id,
      savedId,
      ...fields
    };
    pushLiveServerLog(logs, entry);
    requestLogHandler?.(entry);
  });

  const server = await new Promise<ExpressListenServer>((resolve, reject) => {
    const instance = app.listen(port, '127.0.0.1', () => {
      resolve(instance);
    });
    instance.on('error', reject);
  });

  const address = server.address();
  const assignedPort = typeof address === 'object' && address !== null ? address.port : port;
  const origin = `http://127.0.0.1:${assignedPort}`;
  const startedAt = Date.now();

  const running: RunningLiveServer = {
    id,
    savedId,
    config,
    port: assignedPort,
    origin,
    startedAt
  };

  let watcher: LiveServerWatcherHandle | null = null;
  if (config.watch) {
    watcher = startLiveServerWatcher(config.root, config.aliases, () => {
      fileChangedHandler?.({ id, origin });
    });
    if (!watcher.watching) {
      running.watchUnavailable = true;
    }
  }

  servers.set(id, { server, running, watcher, logs });
  emitServersChanged();
  return running;
}

/**
 * Stops one running live server.
 *
 * @param id - Runtime instance id.
 */
export async function stopLiveServer(id: string): Promise<void> {
  const entry = servers.get(id);
  if (!entry) {
    return;
  }
  servers.delete(id);
  entry.watcher?.stop();
  await new Promise<void>((resolve, reject) => {
    entry.server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
  emitServersChanged();
}

/**
 * Returns a snapshot of currently running live servers.
 *
 * @returns Running instances in start-order (Map insertion order).
 */
export function listRunningLiveServers(): RunningLiveServer[] {
  return [...servers.values()].map((entry) => ({ ...entry.running }));
}

/**
 * Stops every live server during app shutdown.
 */
export async function stopAllLiveServers(): Promise<void> {
  const ids = [...servers.keys()];
  for (const id of ids) {
    // Sequential close avoids racing Node's HTTP shutdown with process exit.
    await stopLiveServer(id);
  }
}
