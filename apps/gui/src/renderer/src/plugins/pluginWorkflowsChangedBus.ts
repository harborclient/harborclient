import type { Disposable, WorkflowsChangedEvent } from '@harborclient/sdk';

type WorkflowsChangedHandler = (event: WorkflowsChangedEvent) => void | Promise<void>;

const handlers = new Set<WorkflowsChangedHandler>();

/**
 * Notifies renderer-side plugin workflows-changed subscribers and bridged webviews.
 *
 * @param event - Coarse invalidation describing which workflow mutation occurred.
 */
export function emitPluginWorkflowsChanged(event: WorkflowsChangedEvent): void {
  for (const handler of handlers) {
    void Promise.resolve(handler(event)).catch((error) => {
      console.error('Plugin renderer workflows-changed handler failed:', error);
    });
  }
  void window.api.pushPluginWorkflowsChanged(event);
}

/**
 * Subscribes to coarse workflow invalidation events for plugin lifecycle hooks.
 *
 * @param handler - Called when workflows are created, updated, renamed, or deleted.
 * @returns A disposable that removes the listener when disposed.
 */
export function subscribePluginWorkflowsChanged(handler: WorkflowsChangedHandler): Disposable {
  handlers.add(handler);
  return {
    dispose: () => {
      handlers.delete(handler);
    }
  };
}

/**
 * Clears all workflows-changed subscribers. Used in tests.
 */
export function clearPluginWorkflowsChangedSubscribers(): void {
  handlers.clear();
}
