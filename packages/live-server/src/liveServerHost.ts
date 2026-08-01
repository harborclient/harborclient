import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import type {
  LiveServerConfig,
  LiveServerFileChangedEvent,
  LiveServerLogEntry,
  LiveServerLogsQuery,
  LiveServerProcessLogEntry,
  LiveServerRequestLogEntry,
  LiveServerRunCommandStatus,
  LiveServerScriptLogEntry,
  LiveServerScriptRef,
  LiveServerSslSettings,
  RunningLiveServer,
  StartLiveServerInput
} from '@harborclient/core/types';
import {
  normalizeLiveServerConfigFields,
  normalizeLiveServerCorsSettings,
  normalizeLiveServerScriptRefs
} from '@harborclient/core/types';
import { substituteVariablesFromMap } from '@harborclient/sdk/variables';
import { createLiveServerApp } from './liveServerApp';
import { createLiveServerLineSplitter } from './liveServerLineSplitter';
import { pushLiveServerLog } from './liveServerLogBuffer';
import {
  clearLiveServerLogSessionLogs,
  createLiveServerLogSession,
  freezeLiveServerLogSession,
  getLiveServerLogSessionLogs
} from './liveServerLogSessions';
import { findFreePort, LIVE_SERVER_PORT_BASE } from './ports';
import type { LiveServerHostProviders } from './providers';
import { startLiveServerRunCommand, type LiveServerRunCommandHandle } from './liveServerRunCommand';
import type { LiveServerScriptsHolder } from './liveServerScripts';
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
   * Ring-buffered access + script + process logs for this instance.
   */
  logs: LiveServerLogEntry[];
  /**
   * Mutable scripts holder read by Express middleware on each request (hot-apply).
   */
  scriptsHolder: LiveServerScriptsHolder;
}

const servers = new Map<string, LiveServerEntry>();

type FileChangedHandler = (event: LiveServerFileChangedEvent) => void;
type ServersChangedHandler = (running: RunningLiveServer[]) => void;
type RequestLogHandler = (entry: LiveServerRequestLogEntry) => void;
type ScriptLogHandler = (entry: LiveServerScriptLogEntry) => void;
type ProcessLogHandler = (entry: LiveServerProcessLogEntry) => void;

let fileChangedHandler: FileChangedHandler | null = null;
let serversChangedHandler: ServersChangedHandler | null = null;
let requestLogHandler: RequestLogHandler | null = null;
let scriptLogHandler: ScriptLogHandler | null = null;
let processLogHandler: ProcessLogHandler | null = null;

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
 * Registers the callback used when a live-server script emits a console/test/error line.
 *
 * @param handler - Receives each script-log entry, or null to clear.
 */
export function setLiveServerScriptLogHandler(handler: ScriptLogHandler | null): void {
  scriptLogHandler = handler;
}

/**
 * Registers the callback used when a companion run command emits output or lifecycle lines.
 *
 * @param handler - Receives each process-log entry, or null to clear.
 */
export function setLiveServerProcessLogHandler(handler: ProcessLogHandler | null): void {
  processLogHandler = handler;
}

/**
 * Builds a short system message for a companion status transition.
 *
 * @param status - New companion status.
 * @param error - Optional detail from the supervisor.
 * @returns Human-readable log line body.
 */
function formatRunCommandSystemMessage(status: LiveServerRunCommandStatus, error?: string): string {
  if (status === 'running') {
    return 'Run command started';
  }
  if (status === 'exited') {
    return error != null && error !== '' ? error : 'Run command exited';
  }
  if (status === 'restarting') {
    return error != null && error !== ''
      ? `Run command restarting: ${error}`
      : 'Run command restarting';
  }
  return error != null && error !== '' ? `Run command failed: ${error}` : 'Run command failed';
}

/**
 * Hot-applies pre/post request scripts on a running live server.
 *
 * Looks up the instance by saved id. No-op when that server is not running.
 *
 * @param savedId - Saved `live_servers.id`.
 * @param scripts - Replacement pre/post script lists (already normalized preferred).
 */
export function updateLiveServerScripts(
  savedId: number,
  scripts: {
    preRequestScripts: LiveServerScriptRef[];
    postRequestScripts: LiveServerScriptRef[];
  }
): void {
  for (const entry of servers.values()) {
    if (entry.running.savedId !== savedId) {
      continue;
    }
    entry.scriptsHolder.preRequestScripts = normalizeLiveServerScriptRefs(
      scripts.preRequestScripts
    );
    entry.scriptsHolder.postRequestScripts = normalizeLiveServerScriptRefs(
      scripts.postRequestScripts
    );
    entry.running = {
      ...entry.running,
      config: {
        ...entry.running.config,
        preRequestScripts: entry.scriptsHolder.preRequestScripts,
        postRequestScripts: entry.scriptsHolder.postRequestScripts
      }
    };
    return;
  }
}

/**
 * Notifies subscribers that the running list changed.
 */
function emitServersChanged(): void {
  serversChangedHandler?.(listRunningLiveServers());
}

/**
 * Returns a snapshot of buffered access and script logs for a session.
 *
 * Resolves active or stopped sessions by runtime id; for `{ savedId }`, prefers
 * the active session then the latest session for that saved server.
 *
 * @param query - Saved id or runtime / session id.
 * @returns Recent mixed log entries, or an empty array when unknown.
 */
export function getLiveServerLogs(query: LiveServerLogsQuery): LiveServerLogEntry[] {
  return getLiveServerLogSessionLogs(query);
}

/**
 * Clears the in-memory request log buffer for a session without removing it.
 *
 * No-op when the queried session does not exist.
 *
 * @param query - Saved id or runtime / session id.
 */
export function clearLiveServerLogs(query: LiveServerLogsQuery): void {
  clearLiveServerLogSessionLogs(query);
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
 * Starts a live server instance.
 *
 * Listens on `config.host` (default loopback). When SSL is enabled, serves
 * HTTPS using the configured certificate and private key files. When
 * `config.port` is null, the next free port from 5500 upward is chosen. An
 * explicit busy port rejects.
 *
 * When `config.runCommand` is non-empty, starts a supervised companion process
 * with cwd set to the document root after the HTTP server is listening.
 * `{{variables}}` in the command resolve from enabled global variables on each
 * spawn (Start and crash restart). Companion stdout/stderr and lifecycle
 * messages are appended to the live-server log session. Spawn/parse failure
 * keeps the HTTP server running and records a failed companion status plus a
 * process log line instead of rolling back listen.
 *
 * `RunningLiveServer.origin` uses `https` when SSL is on, and substitutes
 * `127.0.0.1` when the bind host is a wildcard (`0.0.0.0` / `::`) so Live Page
 * can navigate to a usable URL.
 *
 * @param input - Runtime id (optional), saved id, and server config.
 * @param providers - Snippets, variables, and script runner from the host app.
 * @returns The running instance including the assigned port and origin.
 */
export async function startLiveServer(
  input: StartLiveServerInput,
  providers: LiveServerHostProviders
): Promise<RunningLiveServer> {
  const config = normalizeConfig(input.config);
  if (!config.root) {
    throw new Error('Root directory is required');
  }

  const id = input.id?.trim() || randomUUID();
  const savedId = input.savedId ?? null;
  await stopLiveServer(id);

  const logs: LiveServerLogEntry[] = [];
  const scriptsHolder: LiveServerScriptsHolder = {
    preRequestScripts: config.preRequestScripts,
    postRequestScripts: config.postRequestScripts
  };
  /**
   * Filled after listen so script middleware can build absolute request URLs.
   */
  const originHolder = { current: '' };

  /**
   * Appends one companion process log line to the shared buffer and notifies
   * subscribers.
   *
   * @param stream - stdout, stderr, or system lifecycle.
   * @param message - Line body (already split for stream output).
   */
  function appendProcessLog(stream: LiveServerProcessLogEntry['stream'], message: string): void {
    const entry: LiveServerProcessLogEntry = {
      kind: 'process',
      id,
      savedId,
      timestamp: Date.now(),
      stream,
      message
    };
    pushLiveServerLog(logs, entry);
    processLogHandler?.(entry);
  }

  const app = createLiveServerApp(config.root, {
    aliases: config.aliases,
    corsSettings: config.cors,
    indexFiles: config.indexFiles,
    headers: config.headers,
    proxies: config.proxies,
    routes: config.routes,
    errorPages: config.errorPages,
    onRequestLog: (fields) => {
      const entry: LiveServerRequestLogEntry = {
        kind: 'access',
        id,
        savedId,
        ...fields
      };
      pushLiveServerLog(logs, entry);
      requestLogHandler?.(entry);
    },
    scripts: {
      getScripts: () => scriptsHolder,
      savedId,
      runtimeId: id,
      getOrigin: () => originHolder.current,
      listSnippets: providers.listSnippets,
      getVariables: providers.getVariables,
      runScript: providers.runScript,
      onScriptLog: (fields) => {
        const entry: LiveServerScriptLogEntry = {
          ...fields,
          id,
          savedId
        };
        pushLiveServerLog(logs, entry);
        scriptLogHandler?.(entry);
      }
    }
  });

  const { server, port: assignedPort } = await listenLiveServerOnPort(
    app,
    config.port,
    config.host,
    config.ssl
  );
  const origin = resolveLiveServerOrigin(config.host, assignedPort, config.ssl.enabled);
  originHolder.current = origin;
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

  // Register session + map entry before the companion so spawn failures and
  // early stdout/stderr can land in the same buffer the UI hydrates from.
  createLiveServerLogSession(
    {
      id,
      savedId,
      serverName: config.name,
      origin,
      startedAt
    },
    logs
  );
  servers.set(id, { server, running, watcher, runCommand: null, logs, scriptsHolder });

  if (config.runCommand !== '') {
    const stdoutSplitter = createLiveServerLineSplitter((line) => {
      appendProcessLog('stdout', line);
    });
    const stderrSplitter = createLiveServerLineSplitter((line) => {
      appendProcessLog('stderr', line);
    });

    /**
     * Flushes partial stdout/stderr lines before a lifecycle system message.
     */
    function flushProcessStreams(): void {
      stdoutSplitter.flush();
      stderrSplitter.flush();
    }

    try {
      const runCommand = await startLiveServerRunCommand({
        command: config.runCommand,
        cwd: config.root,
        restartOnCrash: config.restartOnCrash,
        /**
         * Substitutes global `{{variables}}` before each companion spawn (Start
         * and crash restart) so updated Settings globals take effect.
         *
         * @param command - Unsubstituted run-command template from config.
         * @returns Command with known globals resolved.
         */
        resolveCommand: (command) => substituteVariablesFromMap(command, providers.getVariables()),
        onOutput: (stream, chunk) => {
          if (stream === 'stdout') {
            stdoutSplitter.push(chunk);
          } else {
            stderrSplitter.push(chunk);
          }
        },
        onStatus: (status, error) => {
          if (status !== 'running') {
            flushProcessStreams();
          }
          setRunCommandStatus(id, status, error);
          appendProcessLog('system', formatRunCommandSystemMessage(status, error));
        }
      });
      const entry = servers.get(id);
      if (entry != null) {
        entry.runCommand = runCommand;
      }
    } catch {
      // onStatus('failed') already updated status and logged; keep HTTP up.
      flushProcessStreams();
    }
  }

  emitServersChanged();
  const current = servers.get(id);
  return current != null ? { ...current.running } : running;
}

/**
 * Stops one running live server.
 *
 * Stops the companion run command (if any) before closing the HTTP server so
 * intentional Stop never triggers restart-on-crash. Retains the log session for
 * the Server Logs sidebar until the user clears sessions.
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
  freezeLiveServerLogSession(id, Date.now());
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
