import type {
  LiveServerLogEntry,
  LiveServerLogSession,
  LiveServerLogsQuery
} from '@harborclient/core/types';

/**
 * Maximum inactive log sessions retained in memory for the Server Logs sidebar.
 *
 * Active sessions are never dropped by this cap; oldest inactive sessions are
 * removed first when the inactive count exceeds this limit.
 */
export const LIVE_SERVER_LOG_SESSION_MAX_INACTIVE = 50;

/**
 * Internal session row: public metadata plus the shared ring buffer of log lines.
 */
interface LiveServerLogSessionEntry {
  /**
   * Public session metadata (no log lines).
   */
  meta: LiveServerLogSession;

  /**
   * Ring-buffered access + script lines for this start.
   */
  logs: LiveServerLogEntry[];
}

const sessions = new Map<string, LiveServerLogSessionEntry>();

type SessionsChangedHandler = (sessions: LiveServerLogSession[]) => void;

let sessionsChangedHandler: SessionsChangedHandler | null = null;

/**
 * Registers the callback used when the log-session list changes.
 *
 * @param handler - Receives the refreshed metadata list, or null to clear.
 */
export function setLiveServerLogSessionsChangedHandler(
  handler: SessionsChangedHandler | null
): void {
  sessionsChangedHandler = handler;
}

/**
 * Emits the current session metadata list to the registered handler.
 */
function emitSessionsChanged(): void {
  sessionsChangedHandler?.(listLiveServerLogSessions());
}

/**
 * Returns public metadata for every retained log session, newest start first.
 *
 * @returns Session metadata without log line payloads.
 */
export function listLiveServerLogSessions(): LiveServerLogSession[] {
  return [...sessions.values()]
    .map((entry) => ({ ...entry.meta }))
    .sort((a, b) => b.startedAt - a.startedAt);
}

/**
 * Registers a new log session for a live-server start.
 *
 * `logs` is shared with the running host entry and Express/script callbacks so
 * get/clear APIs and the live buffer stay in sync. Call after listen succeeds
 * so `origin` and `startedAt` are known.
 *
 * @param input - Session identity and display fields at start time.
 * @param logs - Shared ring buffer for this session (may already be empty).
 */
export function createLiveServerLogSession(
  input: {
    id: string;
    savedId: number | null;
    serverName: string;
    origin: string;
    startedAt: number;
  },
  logs: LiveServerLogEntry[]
): void {
  sessions.set(input.id, {
    meta: {
      id: input.id,
      savedId: input.savedId,
      serverName: input.serverName,
      origin: input.origin,
      startedAt: input.startedAt,
      stoppedAt: null,
      active: true
    },
    logs
  });
  pruneInactiveSessions();
  emitSessionsChanged();
}

/**
 * Marks a session inactive after the runtime instance stops, keeping its lines.
 *
 * No-op when the session id is unknown (e.g. already cleared).
 *
 * @param id - Runtime / session id.
 * @param stoppedAt - Unix timestamp (ms) when the instance stopped.
 */
export function freezeLiveServerLogSession(id: string, stoppedAt: number): void {
  const entry = sessions.get(id);
  if (entry == null) {
    return;
  }
  entry.meta = {
    ...entry.meta,
    active: false,
    stoppedAt
  };
  pruneInactiveSessions();
  emitSessionsChanged();
}

/**
 * Finds a session entry by saved id or runtime id.
 *
 * For `{ savedId }`, prefers the active session, then the newest started session.
 *
 * @param query - Saved id or runtime / session id.
 * @returns Matching entry, or undefined when none exists.
 */
function findSessionEntry(query: LiveServerLogsQuery): LiveServerLogSessionEntry | undefined {
  if ('id' in query) {
    return sessions.get(query.id);
  }

  let active: LiveServerLogSessionEntry | undefined;
  let latest: LiveServerLogSessionEntry | undefined;
  for (const entry of sessions.values()) {
    if (entry.meta.savedId !== query.savedId) {
      continue;
    }
    if (entry.meta.active) {
      active = entry;
    }
    if (latest == null || entry.meta.startedAt > latest.meta.startedAt) {
      latest = entry;
    }
  }
  return active ?? latest;
}

/**
 * Returns a snapshot of buffered logs for a session (active or stopped).
 *
 * @param query - Saved id or runtime / session id.
 * @returns Recent mixed log entries, or an empty array when unknown.
 */
export function getLiveServerLogSessionLogs(query: LiveServerLogsQuery): LiveServerLogEntry[] {
  const entry = findSessionEntry(query);
  return entry != null ? [...entry.logs] : [];
}

/**
 * Clears the log lines for one session without removing the session from the list.
 *
 * No-op when the session is unknown.
 *
 * @param query - Saved id or runtime / session id.
 */
export function clearLiveServerLogSessionLogs(query: LiveServerLogsQuery): void {
  const entry = findSessionEntry(query);
  if (entry == null) {
    return;
  }
  entry.logs.length = 0;
}

/**
 * Clears retained server logs: drops inactive sessions and empties active buffers.
 *
 * Active sessions stay listed (green) so a still-running server keeps streaming
 * into the same shared buffer after erase.
 *
 * @returns Whether any sessions were present before clearing.
 */
export function clearAllLiveServerLogSessions(): boolean {
  if (sessions.size === 0) {
    return false;
  }
  for (const [id, entry] of [...sessions.entries()]) {
    entry.logs.length = 0;
    if (!entry.meta.active) {
      sessions.delete(id);
    }
  }
  emitSessionsChanged();
  return true;
}

/**
 * Resolves the best session id for a saved live server (active, else latest).
 *
 * @param savedId - Saved `live_servers.id`.
 * @returns Session id, or null when no sessions exist for that server.
 */
export function findLiveServerLogSessionIdForSavedId(savedId: number): string | null {
  const entry = findSessionEntry({ savedId });
  return entry?.meta.id ?? null;
}

/**
 * Drops oldest inactive sessions when the inactive count exceeds the cap.
 */
function pruneInactiveSessions(): void {
  const inactive = [...sessions.values()]
    .filter((entry) => !entry.meta.active)
    .sort((a, b) => a.meta.startedAt - b.meta.startedAt);

  const overflow = inactive.length - LIVE_SERVER_LOG_SESSION_MAX_INACTIVE;
  if (overflow <= 0) {
    return;
  }

  for (let i = 0; i < overflow; i += 1) {
    const entry = inactive[i];
    if (entry == null) {
      break;
    }
    entry.logs.length = 0;
    sessions.delete(entry.meta.id);
  }
}

/**
 * Clears all sessions (test helper). Does not emit change events.
 */
export function resetLiveServerLogSessionsForTests(): void {
  for (const entry of sessions.values()) {
    entry.logs.length = 0;
  }
  sessions.clear();
}
