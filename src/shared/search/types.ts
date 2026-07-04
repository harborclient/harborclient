/**
 * Search domains surfaced in the global command palette and grouped result lists.
 */
export type SearchDomain =
  | 'collection'
  | 'folder'
  | 'request'
  | 'environment'
  | 'setting'
  | 'plugin'
  | 'theme';

/**
 * Display order for grouped search results in the command palette.
 */
export const SEARCH_DOMAIN_ORDER: SearchDomain[] = [
  'collection',
  'folder',
  'request',
  'environment',
  'setting',
  'plugin',
  'theme'
];

/**
 * Human-readable group labels keyed by search domain.
 */
export const SEARCH_DOMAIN_LABELS: Record<SearchDomain, string> = {
  collection: 'Collections',
  folder: 'Folders',
  request: 'Requests',
  environment: 'Environments',
  setting: 'Settings',
  plugin: 'Plugins',
  theme: 'Themes'
};

/**
 * Maximum number of results shown in the global command palette.
 */
export const SEARCH_ANYTHING_MAX_RESULTS = 8;

/**
 * Whether a plugin or theme hit comes from the installed list or marketplace catalog.
 */
export type PluginListingSource = 'installed' | 'marketplace';

/**
 * One normalized hit returned by {@link searchAll} for rendering and navigation.
 */
export interface UnifiedSearchHit {
  /** Result category used for grouping and navigation dispatch. */
  domain: SearchDomain;
  /** Stable identifier within the domain (composite sidebar id, setting id, plugin or theme id). */
  id: string;
  /** Primary label shown in the result row. */
  title: string;
  /** Secondary context line (collection name, setting description, plugin summary). */
  subtitle?: string;
  /** HTTP method badge for request hits. */
  method?: string;
  /** MiniSearch relevance score for ordering within a domain. */
  score: number;
  /** Numeric collection id when the hit belongs to the collections tree. */
  collectionId?: number;
  /** Numeric folder id when the hit is scoped to a folder. */
  folderId?: number | null;
  /** Distinguishes installed vs marketplace plugin/theme hits in Search Anything. */
  pluginListingSource?: PluginListingSource;
}

/**
 * Shared MiniSearch options used across HarborClient search indexes.
 */
export const DEFAULT_SEARCH_OPTIONS = {
  prefix: true,
  fuzzy: 0.2 as const
};
