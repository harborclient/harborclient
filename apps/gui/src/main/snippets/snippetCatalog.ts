import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import {
  parseSnippetCatalog,
  SNIPPET_CATALOG_URL,
  type SnippetCatalog,
  type SnippetCatalogEntry
} from '#/shared/snippet/catalog';

/**
 * Fetches and parses one snippet catalog document from a remote URL.
 *
 * @param url - Catalog JSON endpoint.
 * @returns Parsed catalog when the request succeeds and the payload is valid.
 */
async function fetchCatalogFromUrl(url: string): Promise<SnippetCatalog | null> {
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
    return parseSnippetCatalog(raw);
  } catch {
    return null;
  }
}

/**
 * Merges snippet catalog entries from multiple sources, keeping the first
 * occurrence of each bundle id.
 *
 * @param catalogs - Parsed catalogs in fetch priority order.
 * @returns Combined catalog with deduplicated bundle ids.
 */
export function mergeSnippetCatalogs(catalogs: SnippetCatalog[]): SnippetCatalog {
  const seen = new Set<string>();
  const snippets: SnippetCatalogEntry[] = [];

  for (const catalog of catalogs) {
    for (const entry of catalog.snippets) {
      if (seen.has(entry.id)) {
        continue;
      }
      seen.add(entry.id);
      snippets.push(entry);
    }
  }

  return {
    schemaVersion: 1,
    snippets
  };
}

/**
 * Candidate filesystem paths for the repository catalog used when the remote
 * marketplace JSON is unavailable.
 *
 * @returns Absolute paths to try in priority order.
 */
export function getLocalSnippetCatalogPaths(): string[] {
  const paths = new Set<string>();

  if (app.isPackaged) {
    paths.add(join(process.resourcesPath, 'plugins/snippet_catalog.json'));
    paths.add(join(process.resourcesPath, 'plugins/catalog.json'));
  }

  paths.add(join(app.getAppPath(), 'plugins/snippet_catalog.json'));
  paths.add(join(app.getAppPath(), 'plugins/catalog.json'));
  paths.add(join(__dirname, '../../plugins/snippet_catalog.json'));
  paths.add(join(__dirname, '../../plugins/catalog.json'));

  return [...paths];
}

/**
 * Reads a generated snippet_catalog.json from disk.
 *
 * @param catalogPath - Absolute path to snippet_catalog.json.
 * @returns Parsed catalog when readable and valid.
 */
function readSnippetCatalogFile(catalogPath: string): SnippetCatalog | null {
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
    return parseSnippetCatalog(raw);
  } catch {
    return null;
  }
}

/**
 * Reads a bundled catalog.json and extracts the snippets array when present.
 *
 * @param paths - Optional override list of catalog paths for tests.
 * @returns Parsed snippet catalog when a readable file contains snippet entries.
 */
export function readLocalSnippetCatalog(
  paths = getLocalSnippetCatalogPaths()
): SnippetCatalog | null {
  for (const catalogPath of paths) {
    if (catalogPath.endsWith('snippet_catalog.json')) {
      const catalog = readSnippetCatalogFile(catalogPath);
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
    if (!Array.isArray(record.snippets) || record.snippets.length === 0) {
      continue;
    }

    const first = record.snippets[0];
    if (typeof first !== 'object' || first == null) {
      continue;
    }

    const firstRecord = first as Record<string, unknown>;
    if (typeof firstRecord.id === 'string' && typeof firstRecord.name === 'string') {
      try {
        return parseSnippetCatalog({
          schemaVersion: 1,
          snippets: record.snippets
        });
      } catch {
        continue;
      }
    }
  }

  return null;
}

/**
 * Fetches the public snippet marketplace catalog, falling back to the local
 * repository catalog when the remote source is unavailable.
 *
 * @param catalogUrls - Optional override list of catalog URLs for tests.
 * @returns Parsed catalog entries sorted for display by the renderer.
 * @throws When neither the remote nor local catalog can be loaded.
 */
export async function fetchSnippetCatalog(
  catalogUrls: string[] = [SNIPPET_CATALOG_URL]
): Promise<SnippetCatalog> {
  const fetched: SnippetCatalog[] = [];

  for (const url of catalogUrls) {
    const catalog = await fetchCatalogFromUrl(url);
    if (catalog) {
      fetched.push(catalog);
    }
  }

  if (fetched.length > 0) {
    return mergeSnippetCatalogs(fetched);
  }

  const local = readLocalSnippetCatalog();
  if (local) {
    return local;
  }

  throw new Error(
    'Failed to load snippet catalog. The marketplace is unavailable and no local catalog was found.'
  );
}
