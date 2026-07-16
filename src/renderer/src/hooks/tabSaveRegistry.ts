import { useEffect, useRef } from 'react';

/**
 * Handler registered by a tab form so File → Save / Ctrl+S can persist it.
 */
export interface TabSaveHandler {
  /**
   * Whether save should run (mirrors the form Save button enabled state).
   */
  canSave: boolean;

  /**
   * Persists the form. May be sync or async.
   */
  save: () => void | Promise<void>;
}

const registry = new Map<string, TabSaveHandler>();

/**
 * Registers or replaces the save handler for a tab.
 *
 * @param tabId - Hosting tab id.
 * @param handler - canSave gate and save callback.
 */
export function registerTabSave(tabId: string, handler: TabSaveHandler): void {
  registry.set(tabId, handler);
}

/**
 * Removes the save handler for a tab when its form unmounts.
 *
 * @param tabId - Hosting tab id.
 */
export function unregisterTabSave(tabId: string): void {
  registry.delete(tabId);
}

/**
 * Invokes the registered save handler for a tab when one exists and canSave is true.
 *
 * @param tabId - Active tab id to look up.
 * @returns True when a handler was found and save was invoked (even if save is async).
 */
export function tryInvokeTabSave(tabId: string): boolean {
  const handler = registry.get(tabId);
  if (handler == null || !handler.canSave) {
    return false;
  }

  void handler.save();
  return true;
}

/**
 * Clears all registrations. Intended for tests only.
 */
export function clearTabSaveRegistry(): void {
  registry.clear();
}

/**
 * Registers the active form's save handler for the given tab while mounted.
 *
 * @param tabId - Hosting tab id, or null/undefined when the form has no tab context.
 * @param canSave - Whether save should run (mirrors the Save button enabled state).
 * @param save - Persist callback invoked by File → Save / Ctrl+S.
 */
export function useTabSaveRegistration(
  tabId: string | null | undefined,
  canSave: boolean,
  save: () => void | Promise<void>
): void {
  const saveRef = useRef(save);

  /**
   * Keeps the latest save callback without re-registering on every render.
   */
  useEffect(() => {
    saveRef.current = save;
  });

  /**
   * Registers this form as the tab's save target and clears it on unmount.
   */
  useEffect(() => {
    if (tabId == null || tabId === '') {
      return;
    }

    registerTabSave(tabId, {
      canSave,
      save: () => saveRef.current()
    });

    return () => {
      unregisterTabSave(tabId);
    };
  }, [tabId, canSave]);
}
