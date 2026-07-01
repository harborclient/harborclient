import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';

import { buildSettingsSearchIndex, searchSettings } from '../catalog/settingsSearch';
import type { SettingId } from '../catalog/catalog';

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

  /**
   * Builds a MiniSearch index over the settings catalog manifest once.
   */
  const searchIndex = useMemo(() => buildSettingsSearchIndex(), []);

  /**
   * Derives matched setting ids from the current query and search index.
   */
  const matchedIds = useMemo(() => searchSettings(searchIndex, query), [searchIndex, query]);

  const isSearching = query.trim().length > 0;

  return {
    query,
    setQuery,
    matchedIds,
    isSearching
  };
}
