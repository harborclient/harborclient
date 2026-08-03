import { useCallback, useEffect, useState } from 'react';
import type { McpServerStatus } from '@harborclient/core/types';

const POLL_INTERVAL_MS = 5000;

/** Subscribers notified when MCP settings/status may have changed outside the poll loop. */
const statusChangeListeners = new Set<() => void>();

/**
 * Asks {@link useMcpServerStatus} subscribers to refresh immediately (e.g. after Settings Save).
 */
export function notifyMcpServerStatusChanged(): void {
  for (const listener of statusChangeListeners) {
    listener();
  }
}

interface McpServerStatusState {
  /**
   * Whether the MCP HTTP listener is accepting connections.
   */
  running: boolean;

  /**
   * Whether the MCP server feature is enabled (footer MCP button visible).
   */
  enabled: boolean;

  /**
   * Bound host when running.
   */
  host?: string;

  /**
   * Assigned listen port when running.
   */
  port?: number;

  /**
   * Refreshes runtime status from main process IPC.
   */
  refresh: () => Promise<void>;
}

/**
 * Loads MCP server runtime status from main process IPC.
 *
 * @returns Resolved status, or stopped/disabled when the IPC call fails.
 */
async function fetchMcpServerStatus(): Promise<McpServerStatus> {
  try {
    return await window.api.getMcpServerStatus();
  } catch {
    return { running: false, enabled: false };
  }
}

/**
 * Polls MCP server runtime status for footer indicators and panels.
 *
 * @returns Current listener status, feature enable flag, and a manual refresh helper.
 */
export function useMcpServerStatus(): McpServerStatusState {
  const [status, setStatus] = useState<McpServerStatus>({ running: false, enabled: false });

  /**
   * Refreshes runtime status from main process IPC.
   */
  const refresh = useCallback(async (): Promise<void> => {
    const next = await fetchMcpServerStatus();
    setStatus(next);
  }, []);

  /**
   * Polls MCP server status on mount and while the window has focus.
   */
  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    /**
     * Loads the latest MCP server status without blocking the effect body.
     */
    const loadStatus = (): void => {
      void fetchMcpServerStatus().then((next) => {
        if (!cancelled) {
          setStatus(next);
        }
      });
    };

    /**
     * Starts polling when the window gains focus.
     */
    const handleFocus = (): void => {
      loadStatus();
      intervalId = setInterval(loadStatus, POLL_INTERVAL_MS);
    };

    /**
     * Stops polling when the window loses focus.
     */
    const handleBlur = (): void => {
      if (intervalId != null) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    };

    /**
     * Refreshes immediately when another part of the app mutates MCP settings.
     */
    const handleExternalChange = (): void => {
      loadStatus();
    };

    loadStatus();
    statusChangeListeners.add(handleExternalChange);

    if (document.hasFocus()) {
      intervalId = setInterval(loadStatus, POLL_INTERVAL_MS);
    }

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      cancelled = true;
      handleBlur();
      statusChangeListeners.delete(handleExternalChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  return {
    running: status.running,
    enabled: status.enabled,
    host: status.host,
    port: status.port,
    refresh
  };
}
