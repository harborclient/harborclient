import { SETTINGS_CATALOG, type SettingId } from './settingsCatalog';
import { createTextSearchIndex, searchTextIndex, type HarborSearchIndex } from './oramaIndex';

/**
 * Indexed fields for settings catalog search.
 */
type SettingsSearchDocument = {
  id: SettingId;
  label: string;
  description: string;
  keywords: string;
};

const SETTINGS_SEARCH_SCHEMA = {
  id: 'string',
  label: 'string',
  description: 'string',
  keywords: 'string'
} as const;

const SETTINGS_SEARCH_PROPERTIES = ['id', 'label', 'description', 'keywords'];

/**
 * Builds an Orama index over the settings catalog manifest.
 *
 * @returns Search index keyed by setting id.
 */
export function buildSettingsSearchIndex(): HarborSearchIndex {
  const documents: SettingsSearchDocument[] = SETTINGS_CATALOG.map((entry) => ({
    id: entry.id,
    label: entry.label,
    description: entry.description,
    keywords: entry.keywords?.join(' ') ?? ''
  }));

  return createTextSearchIndex(SETTINGS_SEARCH_SCHEMA, documents);
}

/**
 * Filters settings catalog entries by a user query using the prebuilt search index.
 *
 * @param index - Orama index built from {@link SETTINGS_CATALOG}.
 * @param query - Raw search text from the settings sidebar search field.
 * @returns Matched setting ids in catalog manifest order, or an empty array when the query is empty.
 */
export function searchSettings(index: HarborSearchIndex, query: string): SettingId[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const matchedIds = new Set<SettingId>(
    searchTextIndex<SettingsSearchDocument>(index, trimmed, {
      properties: SETTINGS_SEARCH_PROPERTIES,
      threshold: 0
    }).map((hit) => hit.document.id)
  );

  return SETTINGS_CATALOG.filter((entry) => matchedIds.has(entry.id)).map((entry) => entry.id);
}

/**
 * Returns settings hits with scores for unified global search.
 *
 * @param index - Orama index built from {@link SETTINGS_CATALOG}.
 * @param query - Raw search text.
 */
export function searchSettingsHits(
  index: HarborSearchIndex,
  query: string
): Array<{ id: SettingId; score: number; label: string; description: string }> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  return searchTextIndex<SettingsSearchDocument>(index, trimmed, {
    properties: SETTINGS_SEARCH_PROPERTIES,
    threshold: 0
  }).map((hit) => ({
    id: hit.document.id,
    score: hit.score,
    label: hit.document.label,
    description: hit.document.description
  }));
}
