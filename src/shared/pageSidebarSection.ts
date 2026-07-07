/**
 * Stable keys for page tabs that use a sidebar section picker.
 */
export type PageSidebarKey = 'settings' | 'plugins' | 'themes' | 'sharing-keys' | 'snippets';

const PAGE_SIDEBAR_KEYS = new Set<PageSidebarKey>([
  'settings',
  'plugins',
  'themes',
  'sharing-keys',
  'snippets'
]);

const SETTINGS_BUILTIN_SECTIONS = new Set<string>([
  'general',
  'syntax',
  'storage',
  'shortcuts',
  'proxy',
  'globals',
  'ai',
  'backup-restore'
]);

const PLUGINS_SECTIONS = new Set<string>(['installed', 'marketplace', 'install', 'settings']);

const THEMES_SECTIONS = new Set<string>(['installed', 'marketplace', 'install']);

const SHARING_KEYS_SECTIONS = new Set<string>(['identity', 'trusted']);

const SNIPPETS_SECTIONS = new Set<string>(['installed', 'marketplace', 'install']);

/**
 * Returns whether a value is a supported page sidebar storage key.
 *
 * @param value - Candidate key from persisted storage or IPC.
 * @returns True when the key identifies a sidebar-backed page tab.
 */
export function isPageSidebarKey(value: unknown): value is PageSidebarKey {
  return typeof value === 'string' && PAGE_SIDEBAR_KEYS.has(value as PageSidebarKey);
}

/**
 * Normalizes a page sidebar storage key.
 *
 * @param value - Candidate key from persisted storage or IPC.
 * @returns Valid page key or null when unrecognized.
 */
export function normalizePageSidebarKey(value: unknown): PageSidebarKey | null {
  return isPageSidebarKey(value) ? value : null;
}

/**
 * Returns whether a section id is valid for the given page sidebar key.
 *
 * @param key - Page sidebar storage key.
 * @param section - Candidate section id.
 * @returns True when the section is allowed for the page.
 */
export function isAllowedPageSidebarSection(key: PageSidebarKey, section: string): boolean {
  switch (key) {
    case 'settings':
      return SETTINGS_BUILTIN_SECTIONS.has(section) || section.startsWith('plugin:');
    case 'plugins':
      return PLUGINS_SECTIONS.has(section);
    case 'themes':
      return THEMES_SECTIONS.has(section);
    case 'sharing-keys':
      return SHARING_KEYS_SECTIONS.has(section);
    case 'snippets':
      return SNIPPETS_SECTIONS.has(section);
  }
}

/**
 * Normalizes a persisted sidebar section for a page key.
 *
 * @param key - Page sidebar storage key.
 * @param value - Candidate section from persisted storage.
 * @returns Valid section id or null when invalid for the page.
 */
export function normalizePageSidebarSection(key: PageSidebarKey, value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  const section = value.trim();
  return isAllowedPageSidebarSection(key, section) ? section : null;
}
