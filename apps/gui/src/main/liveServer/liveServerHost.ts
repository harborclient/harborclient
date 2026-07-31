import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import type {
  LiveServerConfig,
  LiveServerFileChangedEvent,
  LiveServerLogsQuery,
  LiveServerRequestLogEntry,
  LiveServerRunCommandStatus,
  LiveServerSslSettings,
  RunningLiveServer,
  StartLiveServerInput
} from '@harborclient/core/types';
import {
  normalizeLiveServerConfigFields,
  normalizeLiveServerCorsSettings
} from '@harborclient/core/types';
import { createLiveServerApp } from './liveServerApp';
import { pushLiveServerLog } from './liveServerLogBuffer';
import { findFreePort, LIVE_SERVER_PORT_BASE } from './ports';
import { startLiveServerRunCommand, type LiveServerRunCommandHandle } from './liveServerRunCommand';
import { startLiveServerWatcher, type LiveServerWatcherHandle } from './liveServerWatcher';

/** HTTP or HTTPS server returned after listen. */
type LiveServerListenServer = http.Server | https.Server;

interface LiveServerEntry {
  server: LiveServerListenServer;
  running: RunningLiveServer;
  watcher: LiveServerWatcherHandle | null;
  /**
   * Supervised companion process started from `config.runCommand`, or null.
   */
  runCommand: LiveServerRunCommandHandle | null;
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
  const fields = normalizeLiveServerConfigFields(config);
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
    cors: normalizeLiveServerCorsSettings(config.cors),
    ...fields
  };
}

/**
 * Formats a bind host for use inside an origin URL.
 *
 * Wildcard binds (`0.0.0.0`, `::`) become `127.0.0.1` so Live Page opens a
 * navigable loopback URL. Bare IPv6 addresses are wrapped in brackets.
 *
 * @param host - Normalized listen bind host.
 * @returns Hostname suitable for `${scheme}://${host}:${port}`.
 */
export function resolveLiveServerOriginHost(host: string): string {
  const trimmed = host.trim();
  if (trimmed === '0.0.0.0' || trimmed === '::') {
    return '127.0.0.1';
  }
  if (trimmed.includes(':') && !trimmed.startsWith('[')) {
    return `[${trimmed}]`;
  }
  return trimmed;
}

/**
 * Builds the Live Page origin for a running live server.
 *
 * Scheme follows SSL enablement. Bind host follows
 * {@link resolveLiveServerOriginHost} so wildcard listens still open on
 * loopback.
 *
 * @param host - Normalized listen bind host.
 * @param port - Assigned TCP port.
 * @param sslEnabled - When true, origin uses `https`.
 * @returns Absolute origin without a trailing slash (e.g. `http://127.0.0.1:5500`).
 */
export function resolveLiveServerOrigin(host: string, port: number, sslEnabled: boolean): string {
  const scheme = sslEnabled ? 'https' : 'http';
  return `${scheme}://${resolveLiveServerOriginHost(host)}:${port}`;
}

/**
 * Reads PEM certificate and private key files for an HTTPS live server.
 *
 * @param ssl - Normalized SSL settings with absolute cert/key paths.
 * @returns Certificate and key buffers for `https.createServer`.
 * @throws When SSL is enabled but paths are empty or files are unreadable.
 */
function readLiveServerSslCredentials(ssl: LiveServerSslSettings): {
  cert: Buffer;
  key: Buffer;
} {
  if (!ssl.certPath || !ssl.keyPath) {
    throw new Error('SSL is enabled but the certificate path or private key path is empty');
  }

  let cert: Buffer;
  let key: Buffer;
  try {
    cert = fs.readFileSync(ssl.certPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read SSL certificate at ${ssl.certPath}: ${message}`);
  }
  try {
    key = fs.readFileSync(ssl.keyPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read SSL private key at ${ssl.keyPath}: ${message}`);
  }

  return { cert, key };
}

/**
 * Returns whether a listen error means the TCP port is already taken.
 *
 * @param error - Unknown rejection from `server.listen`.
 * @returns True when the error is `EADDRINUSE`.
 */
function isAddressInUseError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'EADDRINUSE'
  );
}

/**
 * Creates an HTTP or HTTPS server for the Express app and begins listening.
 *
 * @param app - Express application to serve.
 * @param port - TCP port to bind.
 * @param host - Bind host (e.g. `127.0.0.1` or `0.0.0.0`).
 * @param ssl - Normalized SSL settings; when enabled, wraps the app in HTTPS.
 * @returns The listening Node server instance.
 * @throws When SSL material cannot be loaded or listen fails.
 */
async function listenLiveServer(
  app: ReturnType<typeof createLiveServerApp>,
  port: number,
  host: string,
  ssl: LiveServerSslSettings
): Promise<LiveServerListenServer> {
  const credentials = ssl.enabled ? readLiveServerSslCredentials(ssl) : null;
  const server: LiveServerListenServer = credentials
    ? https.createServer(credentials, app)
    : http.createServer(app);

  return await new Promise<LiveServerListenServer>((resolve, reject) => {
    /**
     * Rejects the listen promise after closing the unbound server.
     *
     * @param error - Listen or bind failure.
     */
    const onError = (error: Error): void => {
      server.off('error', onError);
      server.close(() => {
        reject(error);
      });
    };
    server.once('error', onError);
    server.listen(port, host, () => {
      server.off('error', onError);
      resolve(server);
    });
  });
}

/** Max auto-port listen retries when another process claims the probed port. */
const AUTO_PORT_LISTEN_RETRIES = 25;

/**
 * Listens on an explicit or auto-selected port, retrying on `EADDRINUSE` when
 * the caller asked for an automatic port (probe-then-listen races).
 *
 * @param app - Express application to serve.
 * @param preferredPort - Explicit port, or null/undefined to auto-select.
 * @param host - Bind host.
 * @param ssl - Normalized SSL settings.
 * @returns Listening server and the port it bound.
 * @throws When an explicit port is busy, SSL material is bad, or no free port works.
 */
async function listenLiveServerOnPort(
  app: ReturnType<typeof createLiveServerApp>,
  preferredPort: number | null | undefined,
  host: string,
  ssl: LiveServerSslSettings
): Promise<{ server: LiveServerListenServer; port: number }> {
  const explicit = preferredPort != null;
  let startFrom = LIVE_SERVER_PORT_BASE;
  let lastError: unknown;

  for (let attempt = 0; attempt < (explicit ? 1 : AUTO_PORT_LISTEN_RETRIES); attempt += 1) {
    const port = await findFreePort(explicit ? preferredPort : null, startFrom, host);
    try {
      const server = await listenLiveServer(app, port, host, ssl);
      return { server, port };
    } catch (error) {
      lastError = error;
      if (explicit || !isAddressInUseError(error)) {
        throw error;
      }
      // Skip the contested port on the next auto-select scan.
      startFrom = port + 1;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to bind live server after ${AUTO_PORT_LISTEN_RETRIES} attempts`);
}

/**
 * Updates companion-process status on a running entry and notifies subscribers.
 *
 * No-op when the instance is no longer registered (stopped mid-transition).
 *
 * @param id - Runtime instance id.
 * @param status - New companion status.
 * @param error - Optional short error message for failed states.
 */
function setRunCommandStatus(id: string, status: LiveServerRunCommandStatus, error?: string): void {
  const entry = servers.get(id);
  if (entry == null) {
    return;
  }
  entry.running = {
    ...entry.running,
    runCommandStatus: status,
    ...(error != null && error !== ''
      ? { runCommandError: error }
      : status === 'running' || status === 'restarting'
        ? { runCommandError: undefined }
        : {})
  };
  // Drop stale error text when recovering to a healthy/restarting state.
  if (status === 'running' || status === 'restarting') {
    delete entry.running.runCommandError;
  }
  emitServersChanged();
}

/**
 * Closes a listening HTTP(S) server without throwing when already closed.
 *
 * @param server - Server to close.
 */
async function closeListenServer(server: LiveServerListenServer): Promise<void> {
  await new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });
}

/**
 * Starts a live server instance.
 *
 * Listens on `config.host` (default loopback). When SSL is enabled, serves
 * HTTPS using the configured certificate and private key files. When
 * `config.port` is null, the next free port from 5500 upward is chosen. An
 * explicit busy port rejects.
 *
 * When `config.runCommand` is non-empty, starts a supervised companion process
 * with cwd set to the document root after the HTTP server is listening. Spawn
 * failure rolls back the listen (and watcher) and rejects.
 *
 * `RunningLiveServer.origin` uses `https` when SSL is on, and substitutes
 * `127.0.0.1` when the bind host is a wildcard (`0.0.0.0` / `::`) so Live Page
 * can navigate to a usable URL.
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
  const app = createLiveServerApp(config.root, {
    aliases: config.aliases,
    corsSettings: config.cors,
    indexFiles: config.indexFiles,
    headers: config.headers,
    proxies: config.proxies,
    routes: config.routes,
    onRequestLog: (fields) => {
      const entry: LiveServerRequestLogEntry = {
        id,
        savedId,
        ...fields
      };
      pushLiveServerLog(logs, entry);
      requestLogHandler?.(entry);
    }
  });

  const { server, port: assignedPort } = await listenLiveServerOnPort(
    app,
    config.port,
    config.host,
    config.ssl
  );
  const origin = resolveLiveServerOrigin(config.host, assignedPort, config.ssl.enabled);
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

  let runCommand: LiveServerRunCommandHandle | null = null;
  if (config.runCommand !== '') {
    try {
      runCommand = await startLiveServerRunCommand({
        command: config.runCommand,
        cwd: config.root,
        restartOnCrash: config.restartOnCrash,
        onStatus: (status, error) => {
          setRunCommandStatus(id, status, error);
        }
      });
      running.runCommandStatus = 'running';
    } catch (error) {
      watcher?.stop();
      await closeListenServer(server);
      throw error;
    }
  }

  servers.set(id, { server, running, watcher, runCommand, logs });
  emitServersChanged();
  return running;
}

/**
 * Stops one running live server.
 *
 * Stops the companion run command (if any) before closing the HTTP server so
 * intentional Stop never triggers restart-on-crash.
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
  if (entry.runCommand != null) {
    await entry.runCommand.stop();
  }
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
