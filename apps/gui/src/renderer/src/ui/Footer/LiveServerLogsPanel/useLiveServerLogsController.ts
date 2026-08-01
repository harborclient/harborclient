import { buildLogsReferenceToken } from '@harborclient/core/ai/scriptReferences';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LiveServerLogEntry } from '@harborclient/core/types';
import { useCopyToChat } from '#/renderer/src/hooks/useCopyToChat';
import { useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectLiveServerLogSessions,
  selectLiveServerLogsSavedId,
  selectLiveServerLogsSessionId,
  selectSavedLiveServers
} from '#/renderer/src/store/selectors';
import type { LiveServerLogTerminalRow } from './LiveServerLogTerminal';
import {
  DEFAULT_LOG_MATCH_OPTIONS,
  isLogFilterQueryValid,
  type LogMatchOptions
} from '#/renderer/src/ui/Shared/LogSearch/logMatchOptions';
import { matchesLiveServerLogEntry } from './matchesLiveServerLogEntry';

/**
 * Debounce window before applying the filter query to terminal lines.
 */
const FILTER_DEBOUNCE_MS = 150;

/**
 * Shared live-server logs viewer state for footer and sidebar hosts.
 *
 * Hydrates the main-process ring buffer for the selected session, streams push
 * events, and derives filter rows plus header chrome labels so only one host
 * mounts a single subscription at a time.
 */
export function useLiveServerLogsController(): {
  serverName: string;
  statusLabel: string;
  isRunning: boolean;
  sessionId: string | null;
  /**
   * Saved live server id for per-server dock placement, when known.
   */
  savedId: number | null;
  liveServerUuid: string | null;
  query: string;
  setQuery: (value: string) => void;
  matchOptions: LogMatchOptions;
  setMatchOptions: (value: LogMatchOptions) => void;
  invalidRegex: boolean;
  filterActive: boolean;
  filteredRows: LiveServerLogTerminalRow[];
  hiddenCount: number;
  canClear: boolean;
  aiAvailable: boolean;
  handleClear: () => void;
  handleAddLogsToChat: () => void;
} {
  const sessionId = useAppSelector(selectLiveServerLogsSessionId);
  const savedId = useAppSelector(selectLiveServerLogsSavedId);
  const sessions = useAppSelector(selectLiveServerLogSessions);
  const savedServers = useAppSelector(selectSavedLiveServers);
  const { aiAvailable, copyToChat } = useCopyToChat();
  const [entries, setEntries] = useState<LiveServerLogEntry[]>([]);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [matchOptions, setMatchOptions] = useState<LogMatchOptions>(DEFAULT_LOG_MATCH_OPTIONS);
  const [filterSessionId, setFilterSessionId] = useState(sessionId);

  // Reset the filter when the selected session changes (adjust state during render).
  if (filterSessionId !== sessionId) {
    setFilterSessionId(sessionId);
    setQuery('');
    setDebouncedQuery('');
    setMatchOptions(DEFAULT_LOG_MATCH_OPTIONS);
  }

  /**
   * Selected log session metadata when it is still retained.
   */
  const session = useMemo(() => {
    if (sessionId == null) {
      return null;
    }
    return sessions.find((item) => item.id === sessionId) ?? null;
  }, [sessionId, sessions]);

  /**
   * Saved live server row for AI/`@logs` targeting when known.
   */
  const savedServer = useMemo(() => {
    const id = session?.savedId ?? savedId;
    if (id == null) {
      return null;
    }
    return savedServers.find((server) => server.id === id) ?? null;
  }, [savedId, savedServers, session?.savedId]);

  const serverName = session?.serverName ?? savedServer?.name ?? 'Live Server';
  const resolvedSavedId = session?.savedId ?? savedId;
  const liveServerUuid = savedServer?.uuid ?? null;
  const isRunning = session?.active === true;
  const origin = session?.origin ?? null;
  const statusLabel =
    sessionId == null ? 'No server selected' : isRunning ? (origin ?? 'Logging') : 'Stopped';

  /**
   * Session-scoped log buffer for the terminal; empty when nothing is selected.
   * Memoized so the filter `useMemo` does not see a fresh `[]` every render.
   */
  const visibleEntries = useMemo(() => (sessionId == null ? [] : entries), [entries, sessionId]);

  /**
   * Whether a non-empty filter is active after debounce.
   */
  const filterActive = debouncedQuery.trim().length > 0;

  /**
   * Whether the live (undebounced) query is an invalid regex while regex mode is on.
   */
  const invalidRegex = !isLogFilterQueryValid(query, matchOptions);

  /**
   * Rows that match the debounced filter, keeping original 1-based line numbers
   * so `@logs` selection ranges stay aligned with the full buffer.
   */
  const filteredRows = useMemo((): LiveServerLogTerminalRow[] => {
    const rows: LiveServerLogTerminalRow[] = [];
    for (let index = 0; index < visibleEntries.length; index += 1) {
      const entry = visibleEntries[index];
      if (entry == null) {
        continue;
      }
      if (!matchesLiveServerLogEntry(entry, debouncedQuery, matchOptions)) {
        continue;
      }
      rows.push({ entry, line: index + 1 });
    }
    return rows;
  }, [debouncedQuery, matchOptions, visibleEntries]);

  /**
   * Count of buffer lines hidden by the active filter.
   */
  const hiddenCount = filterActive ? visibleEntries.length - filteredRows.length : 0;

  /**
   * Debounces the filter query so typing does not refilter on every keystroke.
   */
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, FILTER_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(handle);
    };
  }, [query]);

  /**
   * Hydrates buffered logs when the selected session changes or the session list
   * updates (for example after the Server Logs section erase action).
   *
   * When `sessionId` is null, {@link visibleEntries} is already empty so this
   * effect only loads for a concrete session (avoids sync setState-in-effect).
   */
  useEffect(() => {
    if (sessionId == null) {
      return;
    }

    // Selected inactive sessions removed by section erase clear `logsSessionId`
    // in the store; skip hydrate until a retained session is selected again.
    if (!sessions.some((item) => item.id === sessionId)) {
      return;
    }

    let cancelled = false;

    /**
     * Loads the current ring-buffer snapshot for this session.
     */
    const hydrate = async (): Promise<void> => {
      try {
        const logs = await window.api.getLiveServerLogs({ id: sessionId });
        if (!cancelled) {
          setEntries(logs);
        }
      } catch {
        if (!cancelled) {
          setEntries([]);
        }
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [sessionId, sessions]);

  /**
   * Subscribes to live request, script, and process log pushes for the selected session.
   */
  useEffect(() => {
    if (sessionId == null) {
      return;
    }

    /**
     * Appends one mixed log entry when it belongs to the selected session.
     *
     * @param entry - Access, script, or process log line from main.
     */
    const appendIfSelected = (entry: LiveServerLogEntry): void => {
      if (entry.id !== sessionId) {
        return;
      }
      setEntries((current) => [...current, entry]);
    };

    const unsubscribeRequest = window.api.onLiveServerRequestLog(appendIfSelected);
    const unsubscribeScript = window.api.onLiveServerScriptLog(appendIfSelected);
    const unsubscribeProcess = window.api.onLiveServerProcessLog(appendIfSelected);
    return () => {
      unsubscribeRequest();
      unsubscribeScript();
      unsubscribeProcess();
    };
  }, [sessionId]);

  /**
   * Clears local lines and the main-process buffer for the selected session.
   */
  const handleClear = useCallback((): void => {
    setEntries([]);
    if (sessionId != null) {
      void window.api.clearLiveServerLogs({ id: sessionId });
    }
  }, [sessionId]);

  /**
   * Opens AI chat with a whole-log `@logs.<uuid>` reference for the selected server.
   */
  const handleAddLogsToChat = useCallback((): void => {
    if (liveServerUuid == null) {
      return;
    }
    void copyToChat(buildLogsReferenceToken(liveServerUuid));
  }, [copyToChat, liveServerUuid]);

  return {
    serverName,
    statusLabel,
    isRunning,
    sessionId,
    savedId: resolvedSavedId,
    liveServerUuid,
    query,
    setQuery,
    matchOptions,
    setMatchOptions,
    invalidRegex,
    filterActive,
    filteredRows,
    hiddenCount,
    canClear: visibleEntries.length > 0,
    aiAvailable,
    handleClear,
    handleAddLogsToChat
  };
}
