import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { PluginInfo } from '#/shared/plugin/types';
import {
  buildInstalledPluginSearchIndex,
  searchInstalledPlugins
} from '#/shared/search/installedPlugins';

interface Result {
  /**
   * Current search query for filtering installed entries.
   */
  searchQuery: string;

  /**
   * Updates the installed search query.
   */
  setSearchQuery: Dispatch<SetStateAction<string>>;

  /**
   * Installed plugins after search filtering.
   */
  filteredPlugins: PluginInfo[];
}

/**
 * Manages installed plugin search state and derives filtered rows from a MiniSearch index.
 *
 * @param plugins - Installed plugin rows already filtered by plugin vs theme kind.
 */
export function useInstalledPluginSearch(plugins: PluginInfo[]): Result {
  const [searchQuery, setSearchQuery] = useState('');

  /**
   * Builds a searchable index over the visible installed plugin rows.
   */
  const searchIndex = useMemo(() => {
    if (plugins.length === 0) {
      return null;
    }
    return buildInstalledPluginSearchIndex(plugins);
  }, [plugins]);

  /**
   * Filters installed rows by the current search query.
   */
  const filteredPlugins = useMemo(() => {
    const trimmed = searchQuery.trim();
    if (!searchIndex) {
      return trimmed ? [] : plugins;
    }
    return searchInstalledPlugins(plugins, searchIndex, searchQuery);
  }, [plugins, searchIndex, searchQuery]);

  return {
    searchQuery,
    setSearchQuery,
    filteredPlugins
  };
}
