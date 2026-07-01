import MiniSearch from 'minisearch';

import { SETTINGS_CATALOG, type SettingId } from './catalog';

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
    storeFields: ['id'],
    searchOptions: {
      prefix: true,
      fuzzy: 0.2,
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
