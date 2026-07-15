import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { parseJson } from '#/shared/parseJson';
import {
  getCachedTeamHubCatalogs,
  getCachedTeamHubTrusted,
  mergeEnabledPluginUrls
} from './teamHubPluginSources';
import {
  getDefaultPluginSources,
  normalizePluginSources,
  type PluginSourcesSettings
} from '#/shared/plugin/catalog';

const STORE_KEY = 'pluginSources';

/**
 * Reads persisted plugin catalog and trusted-key source settings.
 *
 * @returns Normalized settings, or HarborClient defaults when nothing is stored.
 */
export function getPluginSources(): PluginSourcesSettings {
  const stored = parseJson<unknown>(getLocalDatabase().getSetting(STORE_KEY), null);
  if (stored == null) {
    return getDefaultPluginSources();
  }
  return normalizePluginSources(stored);
}

/**
 * Persists plugin catalog and trusted-key source settings.
 *
 * @param input - Settings to store.
 * @returns Normalized settings written to storage.
 */
export function setPluginSources(input: PluginSourcesSettings): PluginSourcesSettings {
  const normalized = normalizePluginSources(input);
  getLocalDatabase().setSetting(STORE_KEY, JSON.stringify(normalized));
  return normalized;
}

/**
 * Returns enabled catalog endpoint URLs in persisted order.
 *
 * @returns HTTPS/HTTP catalog URLs that should be fetched for the marketplace.
 */
export function getEnabledCatalogUrls(): string[] {
  const userUrls = getPluginSources()
    .catalogs.filter((source) => source.enabled)
    .map((source) => source.url);
  const hubUrls = getCachedTeamHubCatalogs().map((source) => source.url);
  return mergeEnabledPluginUrls(userUrls, hubUrls);
}

/**
 * Returns enabled trusted-key registry endpoint URLs in persisted order.
 *
 * @returns HTTPS/HTTP trusted.json URLs used for signature verification.
 */
export function getEnabledTrustedUrls(): string[] {
  const userUrls = getPluginSources()
    .trusted.filter((source) => source.enabled)
    .map((source) => source.url);
  const hubUrls = getCachedTeamHubTrusted().map((source) => source.url);
  return mergeEnabledPluginUrls(userUrls, hubUrls);
}
