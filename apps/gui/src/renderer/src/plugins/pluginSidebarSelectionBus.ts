import type { Disposable, SidebarSelection } from '@harborclient/sdk';
import { store } from '#/renderer/src/store/redux';
import {
  applySidebarSelection,
  selectionFromState,
  selectionsEqual,
  validateSidebarSelection
} from './sidebarSelectionMapping';

type SidebarSelectionHandler = (selection: SidebarSelection | null) => void | Promise<void>;

const handlers = new Set<SidebarSelectionHandler>();

/** Last emitted selection used to dedupe store-subscription and explicit emits. */
let lastEmitted: SidebarSelection | null | undefined = undefined;

/**
 * Notifies renderer-side plugin selection subscribers and bridged webviews.
 *
 * Dedupes consecutive identical selections so store subscriptions and explicit
 * emit call sites can both call this safely.
 *
 * @param selection - Current host sidebar selection, or null when cleared.
 */
export function emitPluginSidebarSelectionChanged(selection: SidebarSelection | null): void {
  if (lastEmitted !== undefined && selectionsEqual(lastEmitted, selection)) {
    return;
  }
  lastEmitted = selection;

  for (const handler of handlers) {
    void Promise.resolve(handler(selection)).catch((error) => {
      console.error('Plugin renderer sidebar-selection handler failed:', error);
    });
  }
  void window.api.pushPluginSidebarSelectionChanged(selection);
}

/**
 * Subscribes to host sidebar selection changes for plugin lifecycle hooks.
 *
 * @param handler - Called when selection changes.
 * @returns A disposable that removes the listener when disposed.
 */
export function subscribePluginSidebarSelectionChanged(
  handler: SidebarSelectionHandler
): Disposable {
  handlers.add(handler);
  return {
    dispose: () => {
      handlers.delete(handler);
    }
  };
}

/**
 * Returns the current host sidebar selection derived from Redux.
 *
 * @returns Current selection, or null when nothing is focused.
 */
export function getSidebarSelection(): SidebarSelection | null {
  return selectionFromState(store.getState());
}

/**
 * Updates host sidebar selection and notifies plugin listeners.
 *
 * @param selection - Target selection, or null to clear.
 * @throws When the payload shape is invalid or referenced entities are unavailable.
 */
export function setSidebarSelection(selection: unknown): void {
  const normalized = validateSidebarSelection(selection);
  applySidebarSelection(normalized);
  emitPluginSidebarSelectionChanged(selectionFromState(store.getState()));
}

/**
 * Starts a Redux store subscription that emits selection changes to plugins.
 *
 * @returns Unsubscribe function.
 */
export function startSidebarSelectionStoreSubscription(): () => void {
  lastEmitted = selectionFromState(store.getState());
  return store.subscribe(() => {
    const next = selectionFromState(store.getState());
    emitPluginSidebarSelectionChanged(next);
  });
}

/**
 * Clears all sidebar-selection subscribers and last-emitted cache. Used in tests.
 */
export function clearPluginSidebarSelectionSubscribers(): void {
  handlers.clear();
  lastEmitted = undefined;
}
