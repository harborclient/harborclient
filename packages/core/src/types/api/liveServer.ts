import type {
  CreateLiveServerInput,
  LiveServer,
  LiveServerFileChangedEvent,
  LiveServerImportResult,
  LiveServerLogEntry,
  LiveServerLogSession,
  LiveServerLogsQuery,
  LiveServerRequestLogEntry,
  RunningLiveServer,
  StartLiveServerInput,
  UpdateLiveServerInput
} from '../liveServer';

export type { LiveServerImportResult };

/**
 * IPC surface for live server runtime control and saved-config persistence.
 */
export interface ApiLiveServer {
  /**
   * Starts a live server and returns the running instance (with assigned port).
   */
  startLiveServer: (input: StartLiveServerInput) => Promise<RunningLiveServer>;

  /**
   * Stops one running live server by runtime instance id.
   */
  stopLiveServer: (id: string) => Promise<void>;

  /**
   * Lists currently running live server instances.
   */
  listRunningLiveServers: () => Promise<RunningLiveServer[]>;

  /**
   * Lists all saved live servers from the local registry.
   */
  listLiveServers: () => Promise<LiveServer[]>;

  /**
   * Creates a saved live server and returns the refreshed list.
   */
  createLiveServer: (input: CreateLiveServerInput) => Promise<LiveServer[]>;

  /**
   * Imports a HarborClient live-server export from a file selected via a native dialog.
   *
   * @returns Import result including any unresolved runtime requirement, or null when canceled.
   */
  importLiveServer: () => Promise<LiveServerImportResult | null>;

  /**
   * Updates a saved live server and returns the refreshed list.
   */
  updateLiveServer: (input: UpdateLiveServerInput) => Promise<LiveServer[]>;

  /**
   * Deletes a saved live server and returns the refreshed list.
   */
  deleteLiveServer: (id: number) => Promise<LiveServer[]>;

  /**
   * Moves a saved live server to another provider and returns the refreshed list.
   */
  moveLiveServer: (id: number, targetConnectionId: string) => Promise<LiveServer[]>;

  /**
   * Persists only the machine-local last opened path for a saved live server.
   */
  setLiveServerLastOpenedPath: (id: number, path: string | null) => Promise<void>;

  /**
   * Returns buffered access and script log lines for a log session.
   *
   * @param query - Saved id or runtime / session id.
   * @returns Snapshot of recent mixed log entries (empty when unknown).
   */
  getLiveServerLogs: (query: LiveServerLogsQuery) => Promise<LiveServerLogEntry[]>;

  /**
   * Clears the in-memory request log buffer for a log session without removing it.
   *
   * @param query - Saved id or runtime / session id.
   */
  clearLiveServerLogs: (query: LiveServerLogsQuery) => Promise<void>;

  /**
   * Lists retained live-server log sessions (metadata only).
   */
  listLiveServerLogSessions: () => Promise<LiveServerLogSession[]>;

  /**
   * Clears retained live-server log sessions.
   *
   * Drops inactive sessions and empties active session buffers (active rows remain).
   */
  clearAllLiveServerLogSessions: () => Promise<void>;

  /**
   * Subscribes to file-change notifications from watched live servers.
   *
   * @param callback - Handler invoked after a debounced change is detected.
   * @returns Unsubscribe function.
   */
  onLiveServerFileChanged: (callback: (event: LiveServerFileChangedEvent) => void) => () => void;

  /**
   * Subscribes to running-server list changes (start/stop).
   *
   * @param callback - Handler invoked with the refreshed running list.
   * @returns Unsubscribe function.
   */
  onLiveServersChanged: (callback: (running: RunningLiveServer[]) => void) => () => void;

  /**
   * Subscribes to live-server log session list changes (start/stop/clear).
   *
   * @param callback - Handler invoked with the refreshed session metadata list.
   * @returns Unsubscribe function.
   */
  onLiveServerLogSessionsChanged: (
    callback: (sessions: LiveServerLogSession[]) => void
  ) => () => void;

  /**
   * Subscribes to Express access-log lines from running live servers.
   *
   * Access-only; script console/test lines are not delivered here.
   *
   * @param callback - Handler invoked for each completed request.
   * @returns Unsubscribe function.
   */
  onLiveServerRequestLog: (callback: (entry: LiveServerRequestLogEntry) => void) => () => void;

  /**
   * Subscribes to live-server script console/test/error log lines.
   *
   * @param callback - Handler invoked for each script log line.
   * @returns Unsubscribe function.
   */
  onLiveServerScriptLog: (
    callback: (entry: import('../liveServer').LiveServerScriptLogEntry) => void
  ) => () => void;

  /**
   * Subscribes to companion run-command stdout/stderr/lifecycle log lines.
   *
   * @param callback - Handler invoked for each process log line.
   * @returns Unsubscribe function.
   */
  onLiveServerProcessLog: (
    callback: (entry: import('../liveServer').LiveServerProcessLogEntry) => void
  ) => () => void;
}
