import { describe, expect, it } from 'vitest';
import type { PluginCatalogEntry } from '#/shared/plugin/catalog';
import { buildPluginCatalogSearchIndex, searchPluginCatalog } from '#/shared/plugin/catalogSearch';

const samplePlugins: PluginCatalogEntry[] = [
  {
    id: 'com.example.demo',
    name: 'Demo Plugin',
    version: '1.0.0',
    summary: 'A sample plugin for tests.',
    author: 'Example Inc.',
    categories: ['utilities'],
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
});
