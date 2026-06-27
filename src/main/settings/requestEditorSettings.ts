import Store from 'electron-store';
import { normalizeEditorTab } from '#/shared/requestEditorTab';
import type { EditorTab } from '#/shared/types';

const STORE_KEY = 'requestEditorTabs';

let store: Store<{ requestEditorTabs: Record<string, EditorTab> }> | null = null;

/**
 * Returns the lazy electron-store instance for request editor tab preferences.
 */
function getStore(): Store<{ requestEditorTabs: Record<string, EditorTab> }> {
  if (!store) {
    store = new Store<{ requestEditorTabs: Record<string, EditorTab> }>({
      name: 'settings',
      defaults: {
        requestEditorTabs: {}
      }
    });
  }
  return store;
}

/**
 * Reads persisted request editor tabs map.
 */
function getTabsMap(): Record<string, EditorTab> {
  const stored = getStore().get(STORE_KEY, {});
  if (!stored || typeof stored !== 'object') {
    return {};
  }
  return stored;
}

/**
 * Returns the persisted editor tab for a storage key.
 *
 * @param key - Saved request id or `tab:${tabId}` for unsaved drafts.
 */
export function getRequestEditorTab(key: string): EditorTab | null {
  const trimmed = key.trim();
  if (!trimmed) return null;
  const stored = getTabsMap()[trimmed];
  return normalizeEditorTab(stored);
}

/**
 * Persists the editor tab for a storage key.
 *
 * @param key - Saved request id or `tab:${tabId}` for unsaved drafts.
 * @param tab - Editor tab to remember.
 */
export function setRequestEditorTab(key: string, tab: EditorTab): void {
  const trimmed = key.trim();
  if (!trimmed) return;

  const tabs = getTabsMap();
  tabs[trimmed] = tab;
  getStore().set(STORE_KEY, tabs);
}

/**
 * Removes persisted editor tab state for a storage key.
 *
 * @param key - Storage key to clear.
 */
export function deleteRequestEditorTab(key: string): void {
  const trimmed = key.trim();
  if (!trimmed) return;

  const tabs = getTabsMap();
  if (!(trimmed in tabs)) return;

  delete tabs[trimmed];
  getStore().set(STORE_KEY, tabs);
}
