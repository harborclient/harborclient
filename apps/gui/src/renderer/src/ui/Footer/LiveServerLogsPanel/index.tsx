import { FooterPanel, RoundButton } from '@harborclient/sdk/components';
import { buildLogsReferenceToken } from '@harborclient/core/ai/scriptReferences';
import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import type { LiveServerRequestLogEntry } from '@harborclient/core/types';
import { faEraser, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
import { useCopyToChat } from '#/renderer/src/hooks/useCopyToChat';
import { useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectLiveServerLogsSavedId,
  selectRunningLiveServers,
  selectSavedLiveServers
} from '#/renderer/src/store/selectors';
import { LiveServerLogTerminal } from './LiveServerLogTerminal';

interface Props {
  /**
   * Whether the panel is visible (slides up when true).
   */
  open: boolean;

  /**
   * Closes the live-server logs panel.
   */
  onClose: () => void;
}

/**
 * Slide-up, resizable footer panel streaming Express request logs for one live server.
 *
 * Hydrates the main-process ring buffer when opened or when the selected saved id
 * changes, then appends push events filtered by that id.
 *
 * @param props - Open state and close handler.
 * @returns Footer panel with terminal-style access log.
 */
export function LiveServerLogsPanel({ open, onClose }: Props): JSX.Element {
  const savedId = useAppSelector(selectLiveServerLogsSavedId);
  const savedServers = useAppSelector(selectSavedLiveServers);
  const runningServers = useAppSelector(selectRunningLiveServers);
  const { aiAvailable, copyToChat } = useCopyToChat();
  const [entries, setEntries] = useState<LiveServerRequestLogEntry[]>([]);

  /**
   * Saved live server row for the selected logs target, when it still exists.
   */
  const savedServer = useMemo(() => {
    if (savedId == null) {
      return null;
    }
    return savedServers.find((server) => server.id === savedId) ?? null;
  }, [savedId, savedServers]);

  /**
   * Running instance for the selected saved id, when the server is up.
   */
  const runningInstance = useMemo(() => {
    if (savedId == null) {
      return null;
    }
    return runningServers.find((server) => server.savedId === savedId) ?? null;
  }, [runningServers, savedId]);

  const serverName = savedServer?.name ?? 'Live Server';
  const liveServerUuid = savedServer?.uuid ?? null;
  const isRunning = runningInstance != null;
  const origin = runningInstance?.origin ?? null;
  const runningId = runningInstance?.id ?? null;
  const statusLabel = savedId == null ? 'No server selected' : (origin ?? 'Stopped');

  /**
   * Lines shown in the terminal; empty when no saved server is selected.
   */
  const visibleEntries = savedId == null ? [] : entries;

  /**
   * Hydrates buffered logs whenever the selected saved id changes.
   */
  useEffect(() => {
    if (savedId == null) {
      return;
    }

    let cancelled = false;

    /**
     * Loads the current ring-buffer snapshot for this saved server.
     */
    const hydrate = async (): Promise<void> => {
      try {
        const logs = await window.api.getLiveServerLogs({ savedId });
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
  }, [savedId]);

  /**
   * Subscribes to live request-log pushes and appends lines for the selected server.
   */
  useEffect(() => {
    if (savedId == null) {
      return;
    }

    const unsubscribe = window.api.onLiveServerRequestLog((entry) => {
      if (entry.savedId !== savedId) {
        return;
      }
      setEntries((current) => [...current, entry]);
    });
    return unsubscribe;
  }, [savedId]);

  /**
   * Re-hydrates when the server transitions from stopped to running so a fresh
   * instance buffer replaces stale local lines from a previous run.
   */
  useEffect(() => {
    if (savedId == null || runningId == null) {
      return;
    }
    let cancelled = false;

    /**
     * Reloads logs after a start so the view matches the new instance buffer.
     */
    const refresh = async (): Promise<void> => {
      try {
        const logs = await window.api.getLiveServerLogs({ savedId });
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
  }, [runningId, savedId]);

  /**
   * Clears local lines and the main-process buffer for the selected saved server.
   */
  const handleClear = useCallback((): void => {
    setEntries([]);
    if (savedId != null) {
      void window.api.clearLiveServerLogs({ savedId });
    }
  }, [savedId]);

  /**
   * Opens AI chat with a whole-log `@logs.<uuid>` reference for the selected server.
   */
  const handleAddLogsToChat = useCallback((): void => {
    if (liveServerUuid == null) {
      return;
    }
    void copyToChat(buildLogsReferenceToken(liveServerUuid));
  }, [copyToChat, liveServerUuid]);

  /**
   * Header actions: AI whole-log pointer (when available), then Clear.
   */
  const headerButtons = useMemo(() => {
    const buttons: JSX.Element[] = [];

    if (aiAvailable && liveServerUuid != null) {
      buttons.push(
        <RoundButton
          key="ai"
          icon={faWandMagicSparkles}
          onClick={handleAddLogsToChat}
          title="Add logs to chat"
          ariaLabel="Add logs to chat"
        />
      );
    }

    buttons.push(
      <RoundButton
        key="clear"
        icon={faEraser}
        onClick={handleClear}
        title="Clear"
        ariaLabel="Clear live server logs"
        disabled={visibleEntries.length === 0}
      />
    );

    return buttons;
  }, [aiAvailable, handleAddLogsToChat, handleClear, liveServerUuid, visibleEntries.length]);

  return (
    <FooterPanel
      id="footer-live-server-logs-panel"
      open={open}
      onClose={onClose}
      closeLabel="live server logs"
      storageKey="hc.liveServerLogsHeight"
      title={
        <span className="inline-flex min-w-0 items-baseline gap-2">
          <span className="truncate">Logs: {serverName}</span>
          <span className="text-muted truncate text-[14px] font-normal">{statusLabel}</span>
        </span>
      }
      buttons={headerButtons}
    >
      <LiveServerLogTerminal
        entries={visibleEntries}
        isRunning={isRunning}
        noServerSelected={savedId == null}
        liveServerUuid={liveServerUuid}
        serverName={serverName}
      />
    </FooterPanel>
  );
}
