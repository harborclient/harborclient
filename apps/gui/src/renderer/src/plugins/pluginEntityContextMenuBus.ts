import type { Disposable } from '@harborclient/sdk';
import type { EntityContextMenuOpenRequest } from './hostEntityContextMenu';

type EntityContextMenuHandler = (request: EntityContextMenuOpenRequest) => void;

const handlers = new Set<EntityContextMenuHandler>();

/**
 * Notifies host subscribers that a plugin requested an entity context menu.
 *
 * @param request - Resolved target and host-viewport coordinates for the menu.
 */
export function emitPluginEntityContextMenuOpen(request: EntityContextMenuOpenRequest): void {
  for (const handler of handlers) {
    try {
      handler(request);
    } catch (error) {
      console.error('Plugin entity context menu handler failed:', error);
    }
  }
}

/**
 * Subscribes to plugin-requested entity context menu opens.
 *
 * @param handler - Called when a plugin asks the host to show a menu.
 * @returns A disposable that removes the listener when disposed.
 */
export function subscribePluginEntityContextMenuOpen(
  handler: EntityContextMenuHandler
): Disposable {
  handlers.add(handler);
  return {
    dispose: () => {
      handlers.delete(handler);
    }
  };
}

/**
 * Clears all entity context menu subscribers. Used in tests.
 */
export function clearPluginEntityContextMenuSubscribers(): void {
  handlers.clear();
}
