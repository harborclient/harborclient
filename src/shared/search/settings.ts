import MiniSearch from 'minisearch';

import { SETTINGS_CATALOG, type SettingId } from '#/shared/search/settingsCatalog';
import { DEFAULT_SEARCH_OPTIONS } from '#/shared/search/types';

/**
 * Indexed fields for settings catalog search.
 */
type SettingsSearchDocument = {
  id: SettingId;
  label: string;
  description: string;
  keywords: string;
};

/**
 * Builds a MiniSearch index over the settings catalog manifest.
 *
 * @returns Search index keyed by setting id.
 */
export function buildSettingsSearchIndex(): MiniSearch<SettingsSearchDocument> {
  const index = new MiniSearch<SettingsSearchDocument>({
    fields: ['id', 'label', 'description', 'keywords'],
    storeFields: ['id', 'label', 'description'],
    searchOptions: {
      ...DEFAULT_SEARCH_OPTIONS,
      combineWith: 'AND'
    }
  });

  const documents: SettingsSearchDocument[] = SETTINGS_CATALOG.map((entry) => ({
    id: entry.id,
    label: entry.label,
    description: entry.description,
    keywords: entry.keywords?.join(' ') ?? ''
  }));

  index.addAll(documents);
  return index;
}

/**
 * Filters settings catalog entries by a user query using the prebuilt search index.
 *
 * @param index - MiniSearch index built from {@link SETTINGS_CATALOG}.
 * @param query - Raw search text from the settings sidebar search field.
 * @returns Matched setting ids in catalog manifest order, or an empty array when the query is empty.
 */
export function searchSettings(
  index: MiniSearch<SettingsSearchDocument>,
  query: string
): SettingId[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const matchedIds = new Set<SettingId>(
    index.search(trimmed).map((result) => result.id as SettingId)
  );

  return SETTINGS_CATALOG.filter((entry) => matchedIds.has(entry.id)).map((entry) => entry.id);
}

/**
 * Returns settings hits with scores for unified global search.
 *
 * @param index - MiniSearch index built from {@link SETTINGS_CATALOG}.
 * @param query - Raw search text.
 */
export function searchSettingsHits(
  index: MiniSearch<SettingsSearchDocument>,
  query: string
): Array<{ id: SettingId; score: number; label: string; description: string }> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  return index.search(trimmed).map((result) => {
    const stored = result as unknown as SettingsSearchDocument;
    return {
      id: stored.id,
      score: result.score,
      label: stored.label,
      description: stored.description
    };
  });
}
