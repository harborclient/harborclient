/**
 * Canonical marketplace plugin category slugs in display order.
 */
export const PLUGIN_CATALOG_CATEGORIES = [
  'requests',
  'auth',
  'environments',
  'import',
  'scripting',
  'logging',
  'jwt',
  'response',
  'themes',
  'collections',
  'editor',
  'testing',
  'export',
  'graphql',
  'websocket',
  'mock',
  'debugging',
  'security',
  'sidebar',
  'utilities'
] as const;

/**
 * One allowed plugin marketplace category slug.
 */
export type PluginCatalogCategory = (typeof PLUGIN_CATALOG_CATEGORIES)[number];

/**
 * Human-readable labels for marketplace category slugs shown in UI.
 */
export const PLUGIN_CATALOG_CATEGORY_LABELS: Record<PluginCatalogCategory, string> = {
  requests: 'Requests',
  auth: 'Authentication',
  environments: 'Environments',
  import: 'Import',
  scripting: 'Scripting',
  logging: 'Logging',
  jwt: 'JWT',
  response: 'Response',
  themes: 'Themes',
  collections: 'Collections',
  editor: 'Editor',
  testing: 'Testing',
  export: 'Export',
  graphql: 'GraphQL',
  websocket: 'WebSocket',
  mock: 'Mocking',
  debugging: 'Debugging',
  security: 'Security',
  sidebar: 'Sidebar',
  utilities: 'Utilities'
};

const categorySet = new Set<string>(PLUGIN_CATALOG_CATEGORIES);

/**
 * Returns whether a string is a recognized plugin marketplace category slug.
 *
 * @param value - Raw category string from catalog JSON.
 * @returns True when the value is a predefined category slug.
 */
export function isPluginCatalogCategory(value: string): value is PluginCatalogCategory {
  return categorySet.has(value);
}

/**
 * Keeps only predefined category slugs, preserving order and removing duplicates.
 *
 * Unknown categories from catalog entries are dropped so third-party catalogs
 * cannot introduce uncontrolled filter labels in the marketplace UI.
 *
 * @param categories - Raw category strings from a catalog entry.
 * @returns Sanitized category slugs, which may be empty when none are recognized.
 */
export function sanitizePluginCatalogCategories(categories: string[]): PluginCatalogCategory[] {
  const seen = new Set<PluginCatalogCategory>();
  const sanitized: PluginCatalogCategory[] = [];

  for (const category of categories) {
    if (!isPluginCatalogCategory(category) || seen.has(category)) {
      continue;
    }
    seen.add(category);
    sanitized.push(category);
  }

  return sanitized;
}
