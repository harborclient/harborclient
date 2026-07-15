import { z } from 'zod';
import { sanitizePluginCatalogCategories } from './catalogCategories';

/**
 * Public URL of the generated plugin catalog served from harborclient.com.
 */
export const PLUGIN_CATALOG_URL = 'https://harborclient.com/plugin_catalog.json';

/**
 * Public URL of the official HarborClient plugin signing key served from harborclient.com.
 */
export const PLUGIN_SIGNING_PUBLIC_KEY_URL = 'https://harborclient.com/plugins/harborclient.key';

/**
 * Public URL of the trusted plugin signing key registry served from harborclient.com.
 */
export const PLUGIN_TRUSTED_KEYS_URL = 'https://harborclient.com/plugins/trusted.json';

const pluginManifestId = z
  .string()
  .min(3)
  .regex(/^[a-zA-Z][a-zA-Z0-9.-]*\.[a-zA-Z][a-zA-Z0-9.-]+$/);

/**
 * Validates that a catalog entry points at a public GitHub repository over HTTPS.
 *
 * @param url - Repository URL from the catalog source file.
 * @returns Trimmed URL when valid.
 */
function parseGitHubRepoUrl(url: string): string {
  const trimmed = url.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Plugin catalog repoUrl is not valid: ${url}`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(`Plugin catalog repoUrl must use https://: ${url}`);
  }

  if (parsed.hostname !== 'github.com') {
    throw new Error(`Plugin catalog repoUrl must be hosted on github.com: ${url}`);
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length < 2) {
    throw new Error(`Plugin catalog repoUrl must include owner and repository: ${url}`);
  }

  return trimmed;
}

const catalogThemeContributionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(['light', 'dark', 'high-contrast'])
});

/**
 * One theme contribution copied from manifest.contributes.themes into the marketplace catalog.
 */
export type CatalogThemeContribution = z.infer<typeof catalogThemeContributionSchema>;

const pluginCatalogEntrySchema = z.object({
  id: pluginManifestId,
  name: z.string().min(1),
  version: z.string().min(1),
  summary: z.string().min(1),
  author: z.string().min(1),
  categories: z.array(z.string().min(1)).transform(sanitizePluginCatalogCategories),
  repoUrl: z.string().min(1).transform(parseGitHubRepoUrl),
  ref: z.string().min(1).optional(),
  homepage: z.string().url().optional(),
  icon: z.string().url().optional(),
  screenshot: z.string().url().optional(),
  screenshots: z.array(z.string().url()).optional(),
  /** Inlined Markdown description fetched from the plugin repository at build time. */
  description: z.string().min(1).optional(),
  minAppVersion: z.string().min(1).optional(),
  /** Theme contributions copied from manifest.contributes.themes at catalog build time. */
  contributes: z
    .object({
      themes: z.array(catalogThemeContributionSchema).optional()
    })
    .optional()
});

/**
 * Zod schema for the plugin marketplace catalog document.
 */
export const pluginCatalogSchema = z.object({
  schemaVersion: z.literal(1),
  plugins: z.array(pluginCatalogEntrySchema)
});

/**
 * One curated plugin listing in the marketplace catalog.
 */
export type PluginCatalogEntry = z.infer<typeof pluginCatalogEntrySchema>;

/**
 * Parsed plugin marketplace catalog returned by the build script and app fetch.
 */
export type PluginCatalog = {
  schemaVersion: 1;
  plugins: PluginCatalogEntry[];
  updatedAt?: string;
};

/**
 * Parses and validates a plugin catalog payload.
 *
 * @param raw - Unknown JSON value from disk or an HTTP response.
 * @returns Validated catalog with unique plugin ids.
 * @throws When the payload is invalid or contains duplicate ids.
 */
export function parsePluginCatalog(raw: unknown): PluginCatalog {
  const parsed = pluginCatalogSchema.parse(raw);
  const seen = new Set<string>();

  for (const entry of parsed.plugins) {
    if (seen.has(entry.id)) {
      throw new Error(`Plugin catalog contains duplicate id: ${entry.id}`);
    }
    seen.add(entry.id);
  }

  return parsed;
}

const pluginTrustedKeyEntrySchema = z.object({
  author: z.string().min(1),
  key: z.string().url()
});

/**
 * One trusted plugin signing key URL entry from trusted.json.
 */
export type PluginTrustedKeyEntry = z.infer<typeof pluginTrustedKeyEntrySchema>;

/**
 * Parsed trusted plugin signing key registry.
 */
export type PluginTrustedKeys = PluginTrustedKeyEntry[];

/**
 * Parses and validates a trusted plugin signing key registry payload.
 *
 * @param raw - Unknown JSON value from disk or an HTTP response.
 * @returns Validated trusted key entries with unique key URLs.
 * @throws When the payload is invalid or contains duplicate key URLs.
 */
export function parsePluginTrustedKeys(raw: unknown): PluginTrustedKeys {
  const parsed = z.array(pluginTrustedKeyEntrySchema).parse(raw);
  const seen = new Set<string>();

  for (const entry of parsed) {
    if (seen.has(entry.key)) {
      throw new Error(`Plugin trusted keys contain duplicate key URL: ${entry.key}`);
    }
    seen.add(entry.key);
  }

  return parsed;
}

/**
 * Validates that a plugin source URL uses http or https and returns the trimmed value.
 *
 * @param url - Catalog or trusted registry URL from user settings.
 * @returns Trimmed URL when valid.
 */
function parsePluginSourceUrl(url: string): string {
  const trimmed = url.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Plugin source URL is not valid: ${url}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Plugin source URL must use http:// or https://: ${url}`);
  }

  return trimmed;
}

const pluginSourceSchema = z.object({
  url: z.string().min(1).transform(parsePluginSourceUrl),
  enabled: z.boolean()
});

/**
 * Zod schema for persisted plugin catalog and trusted-key source settings.
 */
export const pluginSourcesSchema = z.object({
  catalogs: z.array(pluginSourceSchema),
  trusted: z.array(pluginSourceSchema)
});

/**
 * One configurable remote endpoint for plugin catalogs or trusted publisher keys.
 */
export type PluginSource = z.infer<typeof pluginSourceSchema>;

/**
 * User-configured plugin catalog and trusted-key registry endpoints.
 */
export type PluginSourcesSettings = z.infer<typeof pluginSourcesSchema>;

/**
 * Returns the built-in HarborClient catalog and trusted-key endpoints, enabled by default.
 *
 * @returns Default plugin source settings with HarborClient URLs first in each list.
 */
export function getDefaultPluginSources(): PluginSourcesSettings {
  return {
    catalogs: [{ url: PLUGIN_CATALOG_URL, enabled: true }],
    trusted: [{ url: PLUGIN_TRUSTED_KEYS_URL, enabled: true }]
  };
}

/**
 * Deduplicates plugin source rows by URL while preserving the first occurrence.
 *
 * @param sources - Raw or normalized plugin source rows.
 * @returns Sources with duplicate URLs removed.
 */
function dedupePluginSources(sources: PluginSource[]): PluginSource[] {
  const seen = new Set<string>();
  const deduped: PluginSource[] = [];

  for (const source of sources) {
    if (seen.has(source.url)) {
      continue;
    }
    seen.add(source.url);
    deduped.push(source);
  }

  return deduped;
}

/**
 * Normalizes persisted plugin source settings with trimmed URLs and deduplication.
 *
 * @param raw - Unknown settings from storage or user input.
 * @returns Validated settings, or defaults when both lists are empty after normalization.
 */
export function normalizePluginSources(raw: unknown): PluginSourcesSettings {
  const parsed = pluginSourcesSchema.safeParse(raw);
  if (!parsed.success) {
    return getDefaultPluginSources();
  }

  const catalogs = dedupePluginSources(parsed.data.catalogs);
  const trusted = dedupePluginSources(parsed.data.trusted);

  if (catalogs.length === 0 && trusted.length === 0) {
    return getDefaultPluginSources();
  }

  return { catalogs, trusted };
}

/**
 * Returns whether a plugin source URL is hosted on harborclient.com or a subdomain.
 *
 * @param url - Catalog or trusted registry URL to inspect.
 * @returns True when the hostname is harborclient.com or ends with .harborclient.com.
 */
export function isHarborClientEndpoint(url: string): boolean {
  try {
    const hostname = new URL(url.trim()).hostname.toLowerCase();
    return hostname === 'harborclient.com' || hostname.endsWith('.harborclient.com');
  } catch {
    return false;
  }
}
