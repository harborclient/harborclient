import Store from 'electron-store';
import { normalizePageSidebarKey, normalizePageSidebarSection } from '#/shared/pageSidebarSection';

const STORE_KEY = 'pageSidebarSections';

let store: Store<{ pageSidebarSections: Record<string, string> }> | null = null;

/**
 * Returns the lazy electron-store instance for page sidebar section preferences.
 */
function getStore(): Store<{ pageSidebarSections: Record<string, string> }> {
  if (!store) {
    store = new Store<{ pageSidebarSections: Record<string, string> }>({
      name: 'settings',
      defaults: {
        pageSidebarSections: {}
      }
    });
  }
  return store;
}

/**
 * Reads persisted page sidebar sections map.
 */
function getSectionsMap(): Record<string, string> {
  const stored = getStore().get(STORE_KEY, {});
  if (!stored || typeof stored !== 'object') {
    return {};
  }
  return stored;
}

/**
 * Returns the persisted sidebar section for a page tab key.
 *
 * @param key - Page sidebar storage key such as `settings` or `plugins`.
 * @returns Normalized section id, or null when unset or invalid.
 */
export function getPageSidebarSection(key: string): string | null {
  const pageKey = normalizePageSidebarKey(key);
  if (!pageKey) {
    return null;
  }

  const stored = getSectionsMap()[pageKey];
  return normalizePageSidebarSection(pageKey, stored);
}

/**
 * Persists the sidebar section for a page tab key.
 *
 * @param key - Page sidebar storage key such as `settings` or `plugins`.
 * @param section - Section id to remember.
 */
export function setPageSidebarSection(key: string, section: string): void {
  const pageKey = normalizePageSidebarKey(key);
  if (!pageKey) {
    return;
  }

  const normalized = normalizePageSidebarSection(pageKey, section);
  if (!normalized) {
    return;
  }

  const sections = getSectionsMap();
  sections[pageKey] = normalized;
  getStore().set(STORE_KEY, sections);
}
