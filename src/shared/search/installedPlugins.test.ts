import { describe, expect, it } from 'vitest';
import type { PluginInfo } from '#/shared/plugin/types';
import {
  buildInstalledPluginSearchIndex,
  searchInstalledPluginHits,
  searchInstalledPlugins
} from './installedPlugins';

/**
 * Builds a minimal installed plugin row for search tests.
 */
function pluginInfo(overrides: Partial<PluginInfo> & Pick<PluginInfo, 'id' | 'name'>): PluginInfo {
  return {
    version: '1.0.0',
    enabled: true,
    path: '/tmp/plugin',
    source: 'git',
    permissions: [],
    manifest: {
      id: overrides.id,
      name: overrides.name,
      version: '1.0.0',
      engines: { harborclient: '>=1.0.0' },
      permissions: []
    },
    ...overrides
  };
}

const samplePlugins: PluginInfo[] = [
  pluginInfo({
    id: 'com.example.demo',
    name: 'Demo Plugin',
    manifest: {
      id: 'com.example.demo',
      name: 'Demo Plugin',
      version: '1.0.0',
      summary: 'A sample plugin for tests.',
      author: 'Example Inc.',
      categories: ['editor'],
      engines: { harborclient: '>=1.0.0' },
      permissions: []
    }
  }),
  pluginInfo({
    id: 'com.example.curl',
    name: 'cURL',
    manifest: {
      id: 'com.example.curl',
      name: 'cURL',
      version: '1.0.0',
      summary: 'Shows an equivalent curl command for the configured request.',
      author: 'HarborClient',
      categories: ['requests'],
      engines: { harborclient: '>=1.0.0' },
      permissions: []
    }
  }),
  pluginInfo({
    id: 'com.example.nord',
    name: 'Nord',
    manifest: {
      id: 'com.example.nord',
      name: 'Nord',
      version: '1.0.0',
      summary: 'Nord color theme.',
      author: 'HarborClient',
      categories: ['themes'],
      engines: { harborclient: '>=1.0.0' },
      permissions: []
    }
  })
];

describe('searchInstalledPlugins', () => {
  const index = buildInstalledPluginSearchIndex(samplePlugins);

  it('returns all plugins when the query is empty or whitespace', () => {
    expect(searchInstalledPlugins(samplePlugins, index, '')).toEqual(samplePlugins);
    expect(searchInstalledPlugins(samplePlugins, index, '   ')).toEqual(samplePlugins);
  });

  it('matches plugins by name', () => {
    expect(searchInstalledPlugins(samplePlugins, index, 'curl').map((plugin) => plugin.id)).toEqual(
      ['com.example.curl']
    );
  });

  it('matches plugins by summary text', () => {
    expect(
      searchInstalledPlugins(samplePlugins, index, 'equivalent curl').map((plugin) => plugin.id)
    ).toEqual(['com.example.curl']);
  });

  it('matches plugins by author', () => {
    expect(
      searchInstalledPlugins(samplePlugins, index, 'Example Inc').map((plugin) => plugin.id)
    ).toEqual(['com.example.demo']);
  });

  it('matches plugins by category token', () => {
    expect(
      searchInstalledPlugins(samplePlugins, index, 'themes').map((plugin) => plugin.id)
    ).toEqual(['com.example.nord']);
  });

  it('returns an empty list when nothing matches', () => {
    expect(searchInstalledPlugins(samplePlugins, index, 'zzzzzzzzzzzz')).toEqual([]);
  });

  it('matches theme plugins by name via searchInstalledPluginHits', () => {
    const hits = searchInstalledPluginHits(index, 'nord');
    expect(hits.map((hit) => hit.id)).toEqual(['com.example.nord']);
  });
});
