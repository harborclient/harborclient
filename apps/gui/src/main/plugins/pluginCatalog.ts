import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import {
  parsePluginCatalog,
  type PluginCatalog,
  type PluginCatalogEntry
} from '#/shared/plugin/catalog';
import { getEnabledCatalogUrls } from '#/main/settings/pluginSourcesSettings';

/**
 * Fetches and parses one plugin catalog document from a remote URL.
 *
 * @param url - Catalog JSON endpoint.
 * @returns Parsed catalog when the request succeeds and the payload is valid.
 */
async function fetchCatalogFromUrl(url: string): Promise<PluginCatalog | null> {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      return null;
    }

    const raw: unknown = await response.json();
    return parsePluginCatalog(raw);
  } catch {
    return null;
  }
}

/**
 * Merges plugin catalog entries from multiple sources, keeping the first
 * occurrence of each plugin id.
 *
 * @param catalogs - Parsed catalogs in fetch priority order.
 * @returns Combined catalog with deduplicated plugin ids.
 */
export function mergePluginCatalogs(catalogs: PluginCatalog[]): PluginCatalog {
  const seen = new Set<string>();
  const plugins: PluginCatalogEntry[] = [];

  for (const catalog of catalogs) {
    for (const entry of catalog.plugins) {
      if (seen.has(entry.id)) {
        continue;
      }
      seen.add(entry.id);
      plugins.push(entry);
    }
  }

  return {
    schemaVersion: 1,
    plugins
  };
}

/**
 * Candidate filesystem paths for the repository catalog used when the remote
 * marketplace JSON is unavailable (for example before docs deploy).
 *
 * @returns Absolute paths to try in priority order.
 */
export function getLocalPluginCatalogPaths(): string[] {
  const paths = new Set<string>();

  if (app.isPackaged) {
    paths.add(join(process.resourcesPath, 'plugins/catalog.json'));
  }

  paths.add(join(app.getAppPath(), 'plugins/catalog.json'));
  paths.add(join(__dirname, '../../plugins/catalog.json'));

  return [...paths];
}

/**
 * Reads and validates the bundled or repository plugin catalog from disk.
 *
 * @param paths - Optional override list of catalog paths for tests.
 * @returns Parsed catalog when a readable file is found.
 */
export function readLocalPluginCatalog(paths = getLocalPluginCatalogPaths()): PluginCatalog | null {
  for (const catalogPath of paths) {
    if (!existsSync(catalogPath)) {
      continue;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(catalogPath, 'utf8')) as unknown;
    } catch {
      continue;
    }

    try {
      return parsePluginCatalog(raw);
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Fetches the public plugin marketplace catalog from all enabled sources,
 * falling back to the local repository catalog when no remote source succeeds.
 *
 * @param catalogUrls - Optional override list of catalog URLs for tests.
 * @returns Parsed catalog entries sorted for display by the renderer.
 * @throws When neither the remote nor local catalog can be loaded.
 */
export async function fetchPluginCatalog(catalogUrls?: string[]): Promise<PluginCatalog> {
  const urls = catalogUrls ?? getEnabledCatalogUrls();
  const fetched: PluginCatalog[] = [];

  for (const url of urls) {
    const catalog = await fetchCatalogFromUrl(url);
    if (catalog) {
      fetched.push(catalog);
    }
  }

  if (fetched.length > 0) {
    return mergePluginCatalogs(fetched);
  }

  const local = readLocalPluginCatalog();
  if (local) {
    return local;
  }

  throw new Error(
    'Failed to load plugin catalog. The marketplace is unavailable and no local catalog was found.'
  );
}
