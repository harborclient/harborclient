import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import type { LiveServerRequestLogEntry } from '@harborclient/core/types';
import type { PageRef } from '#/renderer/src/store/tabs';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectRunningLiveServers, selectSavedLiveServers } from '#/renderer/src/store/selectors';
import { LiveServerLogTerminal } from './LiveServerLogTerminal';
import { LiveServerLogsHeader } from './LiveServerLogsHeader';

interface Props {
  /**
   * Active live-server-logs page tab identity.
   */
  page: Extract<PageRef, { type: 'live-server-logs' }>;
}

/**
 * Full-page terminal that hydrates and streams Express request logs for one live server.
 *
 * Loads the main-process ring buffer on mount, then appends push events filtered by
 * {@link page.savedId}. Clear empties both the local view and the main buffer.
 *
 * @param props - Page identity with the saved live server id.
 * @returns Logs page with header and streaming terminal.
 */
export function LiveServerLogs({ page }: Props): JSX.Element {
  const savedServers = useAppSelector(selectSavedLiveServers);
  const runningServers = useAppSelector(selectRunningLiveServers);
  const [entries, setEntries] = useState<LiveServerRequestLogEntry[]>([]);

  /**
   * Saved live server row for this page, when it still exists.
   */
  const savedServer = useMemo(() => {
    return savedServers.find((server) => server.id === page.savedId) ?? null;
  }, [page.savedId, savedServers]);

  /**
   * Running instance for this saved id, when the server is up.
   */
  const runningInstance = useMemo(() => {
    return runningServers.find((server) => server.savedId === page.savedId) ?? null;
  }, [page.savedId, runningServers]);

  const serverName = savedServer?.name ?? 'Live Server';
  const isRunning = runningInstance != null;
  const origin = runningInstance?.origin ?? null;
  const runningId = runningInstance?.id ?? null;

  /**
   * Hydrates buffered logs from main whenever this page mounts or the saved id changes.
   */
  useEffect(() => {
    let cancelled = false;

    /**
     * Loads the current ring-buffer snapshot for this saved server.
     */
    const hydrate = async (): Promise<void> => {
      try {
        const logs = await window.api.getLiveServerLogs({ savedId: page.savedId });
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
  }, [page.savedId]);

  /**
   * Subscribes to live request-log pushes and appends lines for this saved server.
   */
  useEffect(() => {
    const unsubscribe = window.api.onLiveServerRequestLog((entry) => {
      if (entry.savedId !== page.savedId) {
        return;
      }
      setEntries((current) => [...current, entry]);
    });
    return unsubscribe;
  }, [page.savedId]);

  /**
   * Re-hydrates when the server transitions from stopped to running so a fresh
   * instance buffer replaces stale local lines from a previous run.
   */
  useEffect(() => {
    if (runningId == null) {
      return;
    }
    let cancelled = false;

    /**
     * Reloads logs after a start so the view matches the new instance buffer.
     */
    const refresh = async (): Promise<void> => {
      try {
        const logs = await window.api.getLiveServerLogs({ savedId: page.savedId });
        if (!cancelled) {
          setEntries(logs);
        }
      } catch {
        // Keep existing lines if hydrate fails mid-stream.
      }
    };

    void refresh();
    return () => {
      cancelled = true;
    };
  }, [page.savedId, runningId]);

  /**
   * Clears local lines and the main-process buffer for this saved server.
   */
  const handleClear = useCallback((): void => {
    setEntries([]);
    void window.api.clearLiveServerLogs({ savedId: page.savedId });
  }, [page.savedId]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <LiveServerLogsHeader
        serverName={serverName}
        origin={origin}
        canClear={entries.length > 0}
        onClear={handleClear}
      />
      <LiveServerLogTerminal entries={entries} isRunning={isRunning} />
    </div>
  );
}
