import {
  parsePluginCatalog,
  PLUGIN_CATALOG_URL,
  type PluginCatalog
} from '#/shared/plugin/catalog';

/**
 * Fetches and validates the public plugin marketplace catalog.
 *
 * @returns Parsed catalog entries sorted for display by the renderer.
 * @throws When the request fails or the response is invalid.
 */
export async function fetchPluginCatalog(): Promise<PluginCatalog> {
  const response = await fetch(PLUGIN_CATALOG_URL, {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to load plugin catalog (HTTP ${response.status})`);
  }

  const raw: unknown = await response.json();
  return parsePluginCatalog(raw);
}
