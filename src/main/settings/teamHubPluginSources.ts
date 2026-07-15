import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { listTeamHubs } from './teamHubSettings';
import { TeamHubClient } from '@harborclient/team-hub-api';
import { parseJson } from '#/shared/parseJson';

import type { TeamHubPluginSource, TeamHubPluginSourcesView } from '#/shared/types';

const STORE_KEY = 'teamHubPluginSources';

/**
 * Cached plugin source URLs grouped by Team Hub connection.
 */
interface TeamHubPluginSourcesCache {
  /**
   * Plugin source URLs keyed by Team Hub connection id.
   */
  hubs: Record<
    string,
    {
      hubId: string;
      hubName: string;
      catalogs: string[];
      trusted: string[];
    }
  >;
}

/**
 * Reads the cached Team Hub plugin source snapshot from local storage.
 *
 * @returns Cached hub plugin sources, or an empty cache when unset.
 */
function readCache(): TeamHubPluginSourcesCache {
  return parseJson<TeamHubPluginSourcesCache>(getLocalDatabase().getSetting(STORE_KEY), {
    hubs: {}
  });
}

/**
 * Persists the Team Hub plugin source cache snapshot.
 *
 * @param cache - Updated cache to store.
 */
function writeCache(cache: TeamHubPluginSourcesCache): void {
  getLocalDatabase().setSetting(STORE_KEY, JSON.stringify(cache));
}

/**
 * Converts cached hub entries into flat catalog or trusted source rows.
 *
 * @param cache - Cached Team Hub plugin sources.
 * @param kind - Catalog or trusted URL list to flatten.
 * @returns Flat source rows in hub iteration order.
 */
function flattenCachedSources(
  cache: TeamHubPluginSourcesCache,
  kind: 'catalogs' | 'trusted'
): TeamHubPluginSource[] {
  const rows: TeamHubPluginSource[] = [];

  for (const entry of Object.values(cache.hubs)) {
    for (const url of entry[kind]) {
      rows.push({
        hubId: entry.hubId,
        hubName: entry.hubName,
        url
      });
    }
  }

  return rows;
}

/**
 * Returns cached Team Hub catalog endpoint URLs.
 *
 * @returns Read-only catalog source rows from the last successful refresh.
 */
export function getCachedTeamHubCatalogs(): TeamHubPluginSource[] {
  return flattenCachedSources(readCache(), 'catalogs');
}

/**
 * Returns cached Team Hub trusted publisher endpoint URLs.
 *
 * @returns Read-only trusted source rows from the last successful refresh.
 */
export function getCachedTeamHubTrusted(): TeamHubPluginSource[] {
  return flattenCachedSources(readCache(), 'trusted');
}

/**
 * Returns cached Team Hub plugin sources for the settings UI.
 *
 * @returns Catalog and trusted source rows grouped for display.
 */
export function getTeamHubPluginSourcesView(): TeamHubPluginSourcesView {
  const cache = readCache();
  return {
    catalogs: flattenCachedSources(cache, 'catalogs'),
    trusted: flattenCachedSources(cache, 'trusted')
  };
}

/**
 * Fetches plugin source URLs from all configured Team Hubs and updates the cache.
 *
 * Unreachable hubs keep their previous cached entries. Hubs removed from settings
 * are dropped from the cache.
 *
 * @returns Updated Team Hub plugin source view after refresh.
 */
export async function refreshTeamHubPluginSources(): Promise<TeamHubPluginSourcesView> {
  const hubs = listTeamHubs();
  const previous = readCache();
  const next: TeamHubPluginSourcesCache = { hubs: {} };

  await Promise.all(
    hubs.map(async (hub) => {
      try {
        const client = new TeamHubClient({ baseUrl: hub.baseUrl, token: hub.token });
        const sources = await client.getPluginSources();
        next.hubs[hub.id] = {
          hubId: hub.id,
          hubName: hub.name,
          catalogs: sources.catalogs,
          trusted: sources.trusted
        };
      } catch {
        const cached = previous.hubs[hub.id];
        if (cached) {
          next.hubs[hub.id] = {
            ...cached,
            hubName: hub.name
          };
        }
      }
    })
  );

  writeCache(next);
  return getTeamHubPluginSourcesView();
}

/**
 * Appends unique Team Hub URLs after user-enabled URLs.
 *
 * @param userUrls - Enabled URLs from user plugin source settings.
 * @param hubUrls - Cached Team Hub source URLs to append.
 * @returns Combined URL list with first-source-wins deduplication.
 */
export function mergeEnabledPluginUrls(userUrls: string[], hubUrls: string[]): string[] {
  const seen = new Set(userUrls);
  const merged = [...userUrls];

  for (const url of hubUrls) {
    if (seen.has(url)) {
      continue;
    }
    seen.add(url);
    merged.push(url);
  }

  return merged;
}
