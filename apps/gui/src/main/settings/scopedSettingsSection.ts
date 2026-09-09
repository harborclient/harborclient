import Store from 'electron-store';
import {
  normalizeScopedSettingsScope,
  normalizeScopedSettingsSection,
  type ScopedSettingsScope
} from '@harborclient/core/scopedSettingsSection';

const STORE_KEY = 'scopedSettingsSections';

let store: Store<{ scopedSettingsSections: Record<string, string> }> | null = null;

/**
 * Returns the lazy electron-store instance for collection/folder settings tabs.
 */
function getStore(): Store<{ scopedSettingsSections: Record<string, string> }> {
  if (!store) {
    store = new Store<{ scopedSettingsSections: Record<string, string> }>({
      name: 'settings',
      defaults: {
        scopedSettingsSections: {}
      }
    });
  }
  return store;
}

/**
 * Reads persisted scoped-settings sections map.
 */
function getSectionsMap(): Record<string, string> {
  const stored = getStore().get(STORE_KEY, {});
  if (!stored || typeof stored !== 'object') {
    return {};
  }
  return stored;
}

/**
 * Returns the persisted SegmentedTabs section for collection or folder settings.
 *
 * @param key - `collection` or `folder`.
 * @returns Normalized section id, or null when unset or invalid.
 */
export function getScopedSettingsSection(key: string): string | null {
  const scope = normalizeScopedSettingsScope(key);
  if (!scope) {
    return null;
  }

  const stored = getSectionsMap()[scope];
  return normalizeScopedSettingsSection(stored);
}

/**
 * Persists the SegmentedTabs section for collection or folder settings.
 *
 * @param key - `collection` or `folder`.
 * @param section - Section id to remember.
 */
export function setScopedSettingsSection(key: string, section: string): void {
  const scope: ScopedSettingsScope | null = normalizeScopedSettingsScope(key);
  if (!scope) {
    return;
  }

  const normalized = normalizeScopedSettingsSection(section);
  if (!normalized) {
    return;
  }

  const sections = getSectionsMap();
  sections[scope] = normalized;
  getStore().set(STORE_KEY, sections);
}
