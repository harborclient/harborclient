import type { Disposable, LiveServerRequestLogEntry, RunningLiveServer } from '@harborclient/sdk';

type RunningChangedHandler = (running: RunningLiveServer[]) => void | Promise<void>;
type RequestLogHandler = (entry: LiveServerRequestLogEntry) => void | Promise<void>;

const runningChangedHandlers = new Set<RunningChangedHandler>();
const requestLogHandlers = new Set<RequestLogHandler>();

/**
 * Notifies renderer-side and bridged plugin subscribers that the running list changed.
 *
 * @param running - Refreshed running live server list from the main process.
 */
export function emitPluginLiveServersRunningChanged(running: RunningLiveServer[]): void {
  for (const handler of runningChangedHandlers) {
    void Promise.resolve(handler(running)).catch((error) => {
      console.error('Plugin renderer liveServers.onRunningChanged handler failed:', error);
    });
  }
  void window.api.pushPluginLiveServersRunningChanged(running);
}

/**
 * Notifies renderer-side and bridged plugin subscribers of a new access-log line.
 *
 * @param entry - Express request log entry from a running live server.
 */
export function emitPluginLiveServerRequestLog(entry: LiveServerRequestLogEntry): void {
  for (const handler of requestLogHandlers) {
    void Promise.resolve(handler(entry)).catch((error) => {
      console.error('Plugin renderer liveServers.onRequestLog handler failed:', error);
    });
  }
  void window.api.pushPluginLiveServerRequestLog(entry);
}

/**
 * Subscribes to running-server list changes for in-host plugin contexts.
 *
 * @param handler - Called with the refreshed running list.
 * @returns A disposable that removes the listener when disposed.
 */
export function subscribePluginLiveServersRunningChanged(
  handler: RunningChangedHandler
): Disposable {
  runningChangedHandlers.add(handler);
  return {
    dispose: () => {
      runningChangedHandlers.delete(handler);
    }
  };
}

/**
 * Subscribes to live-server access-log lines for in-host plugin contexts.
 *
 * @param handler - Called for each completed request.
 * @returns A disposable that removes the listener when disposed.
 */
export function subscribePluginLiveServerRequestLog(handler: RequestLogHandler): Disposable {
  requestLogHandlers.add(handler);
  return {
    dispose: () => {
      requestLogHandlers.delete(handler);
    }
  };
}

/**
 * Clears all live-server event subscribers. Used in tests.
 */
export function clearPluginLiveServersSubscribers(): void {
  runningChangedHandlers.clear();
  requestLogHandlers.clear();
}
