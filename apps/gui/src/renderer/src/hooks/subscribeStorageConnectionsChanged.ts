/**
 * Subscribes to storage connection list changes from the main process.
 *
 * @param onChanged - Handler invoked when connections are saved or deleted.
 * @returns Unsubscribe function.
 */
export function subscribeStorageConnectionsChanged(onChanged: () => void): () => void {
  return window.api.onStorageConnectionsChanged(onChanged);
}
