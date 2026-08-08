/**
 * Local fan-out for storage connection list changes.
 *
 * Many hooks (`useProviders`, `useTeamHubs`, `useGitStatuses`) subscribe on every
 * mount. Wiring each call straight to `ipcRenderer.on` quickly exceeds Electron's
 * default MaxListeners (10) and logs a false memory-leak warning. One shared IPC
 * subscription keeps the renderer at a single listener regardless of call count.
 */
const listeners = new Set<() => void>();

/** Unsubscribe from the shared IPC channel, or null when no IPC listener is active. */
let unsubscribeIpc: (() => void) | null = null;

/**
 * Invokes every registered local listener when the main process reports a change.
 */
function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Ensures a single IPC subscription exists while at least one local listener is registered.
 */
function ensureIpcSubscription(): void {
  if (unsubscribeIpc != null) return;
  unsubscribeIpc = window.api.onStorageConnectionsChanged(notifyListeners);
}

/**
 * Tears down the shared IPC subscription when the last local listener unsubscribes.
 */
function releaseIpcSubscriptionIfIdle(): void {
  if (listeners.size > 0 || unsubscribeIpc == null) return;
  unsubscribeIpc();
  unsubscribeIpc = null;
}

/**
 * Subscribes to storage connection list changes from the main process.
 *
 * Multiple callers share one IPC listener; each still receives its own callback
 * and can unsubscribe independently.
 *
 * @param onChanged - Handler invoked when connections are saved or deleted.
 * @returns Unsubscribe function.
 */
export function subscribeStorageConnectionsChanged(onChanged: () => void): () => void {
  listeners.add(onChanged);
  ensureIpcSubscription();
  return () => {
    listeners.delete(onChanged);
    releaseIpcSubscriptionIfIdle();
  };
}
