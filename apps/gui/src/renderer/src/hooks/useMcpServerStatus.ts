import { useCallback, useEffect, useState } from 'react';
import type { McpServerStatus } from '#/shared/types';

const POLL_INTERVAL_MS = 5000;

interface McpServerStatusState {
  /**
   * Whether the MCP HTTP listener is accepting connections.
   */
  running: boolean;

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
 * @returns Resolved status, or stopped when the IPC call fails.
 */
async function fetchMcpServerStatus(): Promise<McpServerStatus> {
  try {
    return await window.api.getMcpServerStatus();
  } catch {
    return { running: false };
  }
}

/**
 * Polls MCP server runtime status for footer indicators and panels.
 *
 * @returns Current listener status and a manual refresh helper.
 */
export function useMcpServerStatus(): McpServerStatusState {
  const [status, setStatus] = useState<McpServerStatus>({ running: false });

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

    loadStatus();

    if (document.hasFocus()) {
      intervalId = setInterval(loadStatus, POLL_INTERVAL_MS);
    }

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      cancelled = true;
      handleBlur();
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  return {
    running: status.running,
    host: status.host,
    port: status.port,
    refresh
  };
}
