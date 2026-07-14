import type { WebContents } from 'electron';

/**
 * Notifies the renderer that configured storage connections changed.
 *
 * @param sender - Web contents that initiated the storage mutation.
 */
export function notifyStorageConnectionsChanged(sender: WebContents): void {
  if (!sender.isDestroyed()) {
    sender.send('storageConnections:changed');
  }
}
