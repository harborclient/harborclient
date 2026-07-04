import { describe, expect, it } from 'vitest';
import type { PluginCatalogEntry } from '#/shared/plugin/catalog';
import { catalogEntryIsTheme } from '#/shared/plugin/themeCategory';
import {
  buildPluginCatalogSearchIndex,
  filterPluginCatalogByCategory,
  searchPluginCatalog,
  searchPluginHits
} from '#/shared/search/plugins';

const samplePlugins: PluginCatalogEntry[] = [
  {
    id: 'com.example.demo',
    name: 'Demo Plugin',
    version: '1.0.0',
    summary: 'A sample plugin for tests.',
    author: 'Example Inc.',
    categories: ['editor'],
    repoUrl: 'https://github.com/example/demo-plugin'
  },
  {
    id: 'com.example.curl',
    name: 'cURL',
    version: '1.0.0',
    summary: 'Shows an equivalent curl command for the configured request.',
    author: 'HarborClient',
    categories: ['requests'],
    repoUrl: 'https://github.com/example/plugin-curl'
  },
  {
    id: 'com.example.history',
    name: 'History',
    version: '1.0.0',
    summary: 'Records every successful HTTP request and response.',
    author: 'HarborClient',
    categories: ['requests', 'logging'],
    repoUrl: 'https://github.com/example/plugin-history'
  },
  {
    id: 'com.example.nord',
    name: 'Nord',
    version: '1.0.0',
    summary: 'Nord color theme.',
    author: 'HarborClient',
    categories: ['themes', 'dark'],
    repoUrl: 'https://github.com/example/plugin-nord'
  },
  {
    id: 'com.example.solar',
    name: 'Solar',
    version: '1.0.0',
    summary: 'Solar light theme.',
    author: 'HarborClient',
    categories: ['themes', 'light'],
    repoUrl: 'https://github.com/example/plugin-solar'
  }
];

describe('searchPluginCatalog', () => {
  const index = buildPluginCatalogSearchIndex(samplePlugins);

  it('returns all plugins when the query is empty or whitespace', () => {
    expect(searchPluginCatalog(samplePlugins, index, '')).toEqual(samplePlugins);
    expect(searchPluginCatalog(samplePlugins, index, '   ')).toEqual(samplePlugins);
  });

  it('matches plugins by name', () => {
    expect(searchPluginCatalog(samplePlugins, index, 'curl').map((entry) => entry.id)).toEqual([
      'com.example.curl'
    ]);
  });

  it('matches plugins by summary text', () => {
    expect(
      searchPluginCatalog(samplePlugins, index, 'successful HTTP').map((entry) => entry.id)
    ).toEqual(['com.example.history']);
  });

  it('matches plugins by author', () => {
    expect(
      searchPluginCatalog(samplePlugins, index, 'Example Inc').map((entry) => entry.id)
    ).toEqual(['com.example.demo']);
  });

  it('matches plugins by category token', () => {
    expect(searchPluginCatalog(samplePlugins, index, 'logging').map((entry) => entry.id)).toEqual([
      'com.example.history'
    ]);
  });

  it('returns an empty list when nothing matches', () => {
    expect(searchPluginCatalog(samplePlugins, index, 'zzzzzzzzzzzz')).toEqual([]);
  });

  it('matches theme catalog entries by name via searchPluginHits', () => {
    const hits = searchPluginHits(index, 'nord');
    expect(hits.map((hit) => hit.id)).toEqual(['com.example.nord']);
  });
});

describe('filterPluginCatalogByCategory', () => {
  it('returns all plugins when no category is selected', () => {
    expect(filterPluginCatalogByCategory(samplePlugins, '')).toEqual(samplePlugins);
  });

  it('returns plugins tagged with the selected category', () => {
    expect(
      filterPluginCatalogByCategory(samplePlugins, 'requests').map((entry) => entry.id)
    ).toEqual(['com.example.curl', 'com.example.history']);
  });

  it('returns an empty list when no plugins match the category', () => {
    expect(filterPluginCatalogByCategory(samplePlugins, 'auth')).toEqual([]);
  });

  it('returns theme plugins when filtering by themes category', () => {
    expect(filterPluginCatalogByCategory(samplePlugins, 'themes').map((entry) => entry.id)).toEqual(
      ['com.example.nord', 'com.example.solar']
    );
  });

  it('returns theme plugins when filtering by appearance category', () => {
    expect(filterPluginCatalogByCategory(samplePlugins, 'dark').map((entry) => entry.id)).toEqual([
      'com.example.nord'
    ]);
    expect(filterPluginCatalogByCategory(samplePlugins, 'light').map((entry) => entry.id)).toEqual([
      'com.example.solar'
    ]);
  });
});

describe('catalog kind partitioning', () => {
  it('separates theme catalog entries from non-theme plugins', () => {
    const themes = samplePlugins.filter(catalogEntryIsTheme);
    const plugins = samplePlugins.filter((entry) => !catalogEntryIsTheme(entry));

    expect(themes.map((entry) => entry.id)).toEqual(['com.example.nord', 'com.example.solar']);
    expect(plugins.map((entry) => entry.id)).toEqual([
      'com.example.demo',
      'com.example.curl',
      'com.example.history'
    ]);
  });
});
