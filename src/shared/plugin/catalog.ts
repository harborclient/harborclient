import { z } from 'zod';

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

const pluginCatalogEntrySchema = z.object({
  id: pluginManifestId,
  name: z.string().min(1),
  version: z.string().min(1),
  summary: z.string().min(1),
  author: z.string().min(1),
  categories: z.array(z.string().min(1)).min(1),
  repoUrl: z.string().min(1).transform(parseGitHubRepoUrl),
  ref: z.string().min(1).optional(),
  homepage: z.string().url().optional(),
  icon: z.string().url().optional(),
  screenshot: z.string().url().optional(),
  minAppVersion: z.string().min(1).optional()
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
