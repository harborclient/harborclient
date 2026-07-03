import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';

import { searchSettings } from '#/shared/search/settings';
import type { SettingId } from '#/shared/search/settingsCatalog';
import { useSearchIndexes } from '#/renderer/src/search/useSearchIndexes';

interface Result {
  /**
   * Raw search text from the settings sidebar search field.
   */
  query: string;

  /**
   * Updates the settings search query.
   */
  setQuery: Dispatch<SetStateAction<string>>;

  /**
   * Setting ids matching the current query in catalog order, or empty when search is inactive.
   */
  matchedIds: SettingId[];

  /**
   * True when the user has entered a non-empty search query.
   */
  isSearching: boolean;
}

/**
 * Manages settings search state and derives matched catalog ids from a MiniSearch index.
 */
export function useSettingsSearch(): Result {
  const [query, setQuery] = useState('');
  const { settingsIndex } = useSearchIndexes();

  /**
   * Derives matched setting ids from the current query and search index.
   */
  const matchedIds = useMemo(() => searchSettings(settingsIndex, query), [settingsIndex, query]);

  const isSearching = query.trim().length > 0;

  return {
    query,
    setQuery,
    matchedIds,
    isSearching
  };
}
