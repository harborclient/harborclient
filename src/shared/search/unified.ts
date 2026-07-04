import type { PluginCatalogEntry } from '#/shared/plugin/catalog';
import type { PluginInfo } from '#/shared/plugin/types';
import { catalogEntryIsTheme, pluginIsTheme } from '#/shared/plugin/themeCategory';
import {
  searchInstalledPluginHits,
  type buildInstalledPluginSearchIndex
} from '#/shared/search/installedPlugins';
import { searchPluginHits, type buildPluginCatalogSearchIndex } from '#/shared/search/plugins';
import { searchSettingsHits, type buildSettingsSearchIndex } from '#/shared/search/settings';
import {
  searchSidebarEntities,
  sidebarEntitySubtitle,
  type SidebarSearchInput,
  type buildSidebarSearchIndex
} from '#/shared/search/sidebar';
import {
  SEARCH_ANYTHING_MAX_RESULTS,
  SEARCH_DOMAIN_ORDER,
  type SearchDomain,
  type UnifiedSearchHit
} from '#/shared/search/types';

/**
 * Live search indexes and source data used by {@link searchAll}.
 */
export interface SearchAllContext {
  /** Sidebar MiniSearch index, or null when sidebar data is not ready. */
  sidebarIndex: ReturnType<typeof buildSidebarSearchIndex> | null;
  /** Settings MiniSearch index (always available once built). */
  settingsIndex: ReturnType<typeof buildSettingsSearchIndex>;
  /** Plugin catalog MiniSearch index, or null when catalog has not loaded. */
  pluginsIndex: ReturnType<typeof buildPluginCatalogSearchIndex> | null;
  /** Installed plugins MiniSearch index, or null when the list is empty. */
  installedPluginsIndex: ReturnType<typeof buildInstalledPluginSearchIndex> | null;
  /** Sidebar entities for subtitle resolution and navigation. */
  sidebarInput: SidebarSearchInput;
  /** Loaded marketplace catalog rows. */
  plugins: PluginCatalogEntry[];
  /** Installed plugin rows from the main process. */
  installedPlugins: PluginInfo[];
}

/**
 * Merges per-domain hit lists with round-robin selection up to the global cap.
 *
 * @param grouped - Hits keyed by domain in display order.
 * @param maxResults - Maximum total hits to return.
 */
export function mergeSearchHitsRoundRobin(
  grouped: Record<SearchDomain, UnifiedSearchHit[]>,
  maxResults: number
): UnifiedSearchHit[] {
  const merged: UnifiedSearchHit[] = [];
  const indices = Object.fromEntries(SEARCH_DOMAIN_ORDER.map((domain) => [domain, 0])) as Record<
    SearchDomain,
    number
  >;

  while (merged.length < maxResults) {
    let added = false;
    for (const domain of SEARCH_DOMAIN_ORDER) {
      const list = grouped[domain];
      const index = indices[domain];
      if (index < list.length) {
        merged.push(list[index]);
        indices[domain] = index + 1;
        added = true;
        if (merged.length >= maxResults) {
          break;
        }
      }
    }
    if (!added) {
      break;
    }
  }

  return merged;
}

/**
 * Groups flat unified hits by domain for rendering section headings.
 *
 * @param hits - Flat result list from {@link searchAll}.
 */
export function groupUnifiedSearchHits(
  hits: UnifiedSearchHit[]
): Array<{ domain: SearchDomain; hits: UnifiedSearchHit[] }> {
  const groups: Array<{ domain: SearchDomain; hits: UnifiedSearchHit[] }> = [];
  for (const domain of SEARCH_DOMAIN_ORDER) {
    const domainHits = hits.filter((hit) => hit.domain === domain);
    if (domainHits.length > 0) {
      groups.push({ domain, hits: domainHits });
    }
  }
  return groups;
}

/**
 * Runs unified search across sidebar, settings, and plugin indexes.
 *
 * @param query - Raw user search text.
 * @param context - Warm indexes and lookup data.
 * @returns Up to {@link SEARCH_ANYTHING_MAX_RESULTS} hits grouped via round-robin across domains.
 */
export function searchAll(query: string, context: SearchAllContext): UnifiedSearchHit[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const grouped: Record<SearchDomain, UnifiedSearchHit[]> = {
    collection: [],
    folder: [],
    request: [],
    environment: [],
    setting: [],
    plugin: [],
    theme: []
  };

  if (context.sidebarIndex != null) {
    for (const hit of searchSidebarEntities(context.sidebarInput, context.sidebarIndex, trimmed)) {
      grouped[hit.kind].push({
        domain: hit.kind,
        id: `${hit.kind}:${hit.entityId}`,
        title: hit.name,
        subtitle: sidebarEntitySubtitle(context.sidebarInput, hit),
        method: hit.method,
        score: hit.score,
        collectionId: hit.collectionId,
        folderId: hit.folderId
      });
    }
  }

  for (const hit of searchSettingsHits(context.settingsIndex, trimmed)) {
    grouped.setting.push({
      domain: 'setting',
      id: hit.id,
      title: hit.label,
      subtitle: hit.description,
      score: hit.score
    });
  }

  if (context.pluginsIndex != null) {
    const catalogById = new Map(context.plugins.map((entry) => [entry.id, entry]));
    for (const hit of searchPluginHits(context.pluginsIndex, trimmed)) {
      const entry = catalogById.get(hit.id);
      const domain: SearchDomain = entry != null && catalogEntryIsTheme(entry) ? 'theme' : 'plugin';
      grouped[domain].push({
        domain,
        id: hit.id,
        title: hit.name,
        subtitle: hit.summary,
        score: hit.score,
        pluginListingSource: 'marketplace'
      });
    }
  }

  if (context.installedPluginsIndex != null) {
    const installedById = new Map(context.installedPlugins.map((plugin) => [plugin.id, plugin]));
    for (const hit of searchInstalledPluginHits(context.installedPluginsIndex, trimmed)) {
      const plugin = installedById.get(hit.id);
      const domain: SearchDomain = plugin != null && pluginIsTheme(plugin) ? 'theme' : 'plugin';
      grouped[domain].push({
        domain,
        id: hit.id,
        title: hit.name,
        subtitle: hit.summary,
        score: hit.score,
        pluginListingSource: 'installed'
      });
    }
  }

  return mergeSearchHitsRoundRobin(grouped, SEARCH_ANYTHING_MAX_RESULTS);
}
