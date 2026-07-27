import type { Disposable, LibraryChangedEvent } from '@harborclient/sdk';

type LibraryChangedHandler = (event: LibraryChangedEvent) => void | Promise<void>;

const handlers = new Set<LibraryChangedHandler>();

/**
 * Notifies renderer-side plugin library-changed subscribers and bridged webviews.
 *
 * @param event - Coarse invalidation describing which library slice changed.
 */
export function emitPluginLibraryChanged(event: LibraryChangedEvent): void {
  for (const handler of handlers) {
    void Promise.resolve(handler(event)).catch((error) => {
      console.error('Plugin renderer library-changed handler failed:', error);
    });
  }
  void window.api.pushPluginLibraryChanged(event);
}

/**
 * Subscribes to coarse library invalidation events for plugin lifecycle hooks.
 *
 * @param handler - Called when collections, folders, requests, or documents refresh.
 * @returns A disposable that removes the listener when disposed.
 */
export function subscribePluginLibraryChanged(handler: LibraryChangedHandler): Disposable {
  handlers.add(handler);
  return {
    dispose: () => {
      handlers.delete(handler);
    }
  };
}

/**
 * Clears all library-changed subscribers. Used in tests.
 */
export function clearPluginLibraryChangedSubscribers(): void {
  handlers.clear();
}
