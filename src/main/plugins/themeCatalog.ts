import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import {
  parseThemeCatalog,
  THEME_CATALOG_URL,
  type PluginCatalogEntry,
  type ThemeCatalog
} from '#/shared/plugin/catalog';

/**
 * Fetches and parses one theme catalog document from a remote URL.
 *
 * @param url - Catalog JSON endpoint.
 * @returns Parsed catalog when the request succeeds and the payload is valid.
 */
async function fetchCatalogFromUrl(url: string): Promise<ThemeCatalog | null> {
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
    return parseThemeCatalog(raw);
  } catch {
    return null;
  }
}

/**
 * Merges theme catalog entries from multiple sources, keeping the first
 * occurrence of each theme plugin id.
 *
 * @param catalogs - Parsed catalogs in fetch priority order.
 * @returns Combined catalog with deduplicated theme plugin ids.
 */
export function mergeThemeCatalogs(catalogs: ThemeCatalog[]): ThemeCatalog {
  const seen = new Set<string>();
  const themes: PluginCatalogEntry[] = [];

  for (const catalog of catalogs) {
    for (const entry of catalog.themes) {
      if (seen.has(entry.id)) {
        continue;
      }
      seen.add(entry.id);
      themes.push(entry);
    }
  }

  return {
    schemaVersion: 1,
    themes
  };
}

/**
 * Candidate filesystem paths for the repository catalog used when the remote
 * marketplace JSON is unavailable.
 *
 * @returns Absolute paths to try in priority order.
 */
export function getLocalThemeCatalogPaths(): string[] {
  const paths = new Set<string>();

  if (app.isPackaged) {
    paths.add(join(process.resourcesPath, 'plugins/theme_catalog.json'));
    paths.add(join(process.resourcesPath, 'plugins/catalog.json'));
  }

  paths.add(join(app.getAppPath(), 'plugins/theme_catalog.json'));
  paths.add(join(app.getAppPath(), 'plugins/catalog.json'));
  paths.add(join(__dirname, '../../plugins/theme_catalog.json'));
  paths.add(join(__dirname, '../../plugins/catalog.json'));

  return [...paths];
}

/**
 * Reads a generated theme_catalog.json from disk.
 *
 * @param catalogPath - Absolute path to theme_catalog.json.
 * @returns Parsed catalog when readable and valid.
 */
function readThemeCatalogFile(catalogPath: string): ThemeCatalog | null {
  if (!existsSync(catalogPath)) {
    return null;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(catalogPath, 'utf8')) as unknown;
  } catch {
    return null;
  }

  try {
    return parseThemeCatalog(raw);
  } catch {
    return null;
  }
}

/**
 * Reads a bundled catalog.json and extracts the themes array when present.
 *
 * Accepts a generated rich `themes` listing (with id/name fields). Thin source
 * rows that only contain repoUrl/ref are skipped because they cannot populate
 * the marketplace UI.
 *
 * @param paths - Optional override list of catalog paths for tests.
 * @returns Parsed theme catalog when a readable file contains theme entries.
 */
export function readLocalThemeCatalog(paths = getLocalThemeCatalogPaths()): ThemeCatalog | null {
  for (const catalogPath of paths) {
    if (catalogPath.endsWith('theme_catalog.json')) {
      const catalog = readThemeCatalogFile(catalogPath);
      if (catalog) {
        return catalog;
      }
      continue;
    }

    if (!existsSync(catalogPath)) {
      continue;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(catalogPath, 'utf8')) as unknown;
    } catch {
      continue;
    }

    if (typeof raw !== 'object' || raw == null) {
      continue;
    }

    const record = raw as Record<string, unknown>;
    if (!Array.isArray(record.themes) || record.themes.length === 0) {
      continue;
    }

    const first = record.themes[0];
    if (typeof first !== 'object' || first == null) {
      continue;
    }

    const firstRecord = first as Record<string, unknown>;
    if (typeof firstRecord.id === 'string' && typeof firstRecord.name === 'string') {
      try {
        return parseThemeCatalog({
          schemaVersion: 1,
          themes: record.themes
        });
      } catch {
        continue;
      }
    }
  }

  return null;
}

/**
 * Fetches the public theme marketplace catalog, falling back to the local
 * repository catalog when the remote source is unavailable.
 *
 * @param catalogUrls - Optional override list of catalog URLs for tests.
 * @returns Parsed catalog entries sorted for display by the renderer.
 * @throws When neither the remote nor local catalog can be loaded.
 */
export async function fetchThemeCatalog(
  catalogUrls: string[] = [THEME_CATALOG_URL]
): Promise<ThemeCatalog> {
  const fetched: ThemeCatalog[] = [];

  for (const url of catalogUrls) {
    const catalog = await fetchCatalogFromUrl(url);
    if (catalog) {
      fetched.push(catalog);
    }
  }

  if (fetched.length > 0) {
    return mergeThemeCatalogs(fetched);
  }

  const local = readLocalThemeCatalog();
  if (local) {
    return local;
  }

  throw new Error(
    'Failed to load theme catalog. The marketplace is unavailable and no local catalog was found.'
  );
}
