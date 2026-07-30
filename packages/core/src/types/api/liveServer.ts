import type {
  CreateLiveServerInput,
  LiveServer,
  LiveServerFileChangedEvent,
  LiveServerLogsQuery,
  LiveServerRequestLogEntry,
  RunningLiveServer,
  StartLiveServerInput,
  UpdateLiveServerInput
} from '../liveServer';

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
   * Updates a saved live server and returns the refreshed list.
   */
  updateLiveServer: (input: UpdateLiveServerInput) => Promise<LiveServer[]>;

  /**
   * Deletes a saved live server and returns the refreshed list.
   */
  deleteLiveServer: (id: number) => Promise<LiveServer[]>;

  /**
   * Returns buffered Express request logs for a running live server.
   *
   * @param query - Saved id or runtime instance id.
   * @returns Snapshot of recent access-log entries (empty when not running).
   */
  getLiveServerLogs: (query: LiveServerLogsQuery) => Promise<LiveServerRequestLogEntry[]>;

  /**
   * Clears the in-memory request log buffer for a running live server.
   *
   * @param query - Saved id or runtime instance id.
   */
  clearLiveServerLogs: (query: LiveServerLogsQuery) => Promise<void>;

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
   * Subscribes to Express request log lines from running live servers.
   *
   * @param callback - Handler invoked for each completed request.
   * @returns Unsubscribe function.
   */
  onLiveServerRequestLog: (callback: (entry: LiveServerRequestLogEntry) => void) => () => void;
}
