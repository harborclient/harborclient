import { describe, expect, it } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import type { Collection, Environment, Folder, SavedRequest } from '#/shared/types';
import { buildSettingsSearchIndex } from '#/shared/search/settings';
import { buildSidebarSearchIndex } from '#/shared/search/sidebar';
import {
  mergeSearchHitsRoundRobin,
  searchAll,
  type SearchAllContext
} from '#/shared/search/unified';
import {
  SEARCH_ANYTHING_MAX_RESULTS,
  type SearchDomain,
  type UnifiedSearchHit
} from '#/shared/search/types';
import { buildPluginCatalogSearchIndex } from '#/shared/search/plugins';
import { buildInstalledPluginSearchIndex } from '#/shared/search/installedPlugins';
import type { PluginCatalogEntry } from '#/shared/plugin/catalog';
import type { PluginInfo } from '#/shared/plugin/types';

const collection: Collection = {
  id: 1,
  uuid: 'col-a',
  name: 'Public API',
  variables: [],
  headers: [],
  auth: defaultAuth(),
  pre_request_script: '',
  post_request_script: '',
  pre_request_scripts: [],
  post_request_scripts: [],
  created_at: '2024-01-01T00:00:00.000Z'
};

const folder: Folder = {
  id: 10,
  collection_id: 1,
  uuid: 'folder-users',
  name: 'Users',
  sort_order: 0,
  created_at: '2024-01-01T00:00:00.000Z'
};

const request: SavedRequest = {
  id: 100,
  uuid: 'req-list-users',
  collection_id: 1,
  name: 'Fetch inventory list',
  method: 'GET',
  url: 'https://inventory.beta.local/items',
  headers: [],
  params: [],
  auth: defaultAuth(),
  body: '',
  body_type: 'none',
  pre_request_script: '',
  post_request_script: '',
  pre_request_scripts: [],
  post_request_scripts: [],
  comment: '',
  tags: '',
  folder_id: 10,
  sort_order: 0,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z'
};

const environment: Environment = {
  id: 200,
  uuid: 'env-prod',
  name: 'Production',
  variables: [],
  created_at: '2024-01-01T00:00:00.000Z'
};

const plugins: PluginCatalogEntry[] = [
  {
    id: 'com.example.curl',
    name: 'cURL',
    version: '1.0.0',
    summary: 'Shows an equivalent curl command.',
    author: 'HarborClient',
    categories: ['requests'],
    repoUrl: 'https://github.com/example/plugin-curl'
  },
  {
    id: 'com.example.nord',
    name: 'Nord',
    version: '1.0.0',
    summary: 'Nord color theme.',
    author: 'HarborClient',
    categories: ['themes'],
    repoUrl: 'https://github.com/example/plugin-nord'
  }
];

const installedPlugins: PluginInfo[] = [
  {
    id: 'com.example.curl',
    name: 'cURL',
    version: '1.0.0',
    enabled: true,
    path: '/tmp/curl',
    source: 'git',
    permissions: [],
    manifest: {
      id: 'com.example.curl',
      name: 'cURL',
      version: '1.0.0',
      summary: 'Shows an equivalent curl command.',
      author: 'HarborClient',
      categories: ['requests'],
      engines: { harborclient: '>=1.0.0' },
      permissions: []
    }
  },
  {
    id: 'com.example.nord',
    name: 'Nord',
    version: '1.0.0',
    enabled: true,
    path: '/tmp/nord',
    source: 'git',
    permissions: [],
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
  }
];

const sidebarInput = {
  collections: [collection],
  foldersByCollection: { 1: [folder] },
  requestsByCollection: { 1: [request] },
  environments: [environment]
};

function buildContext(): SearchAllContext {
  return {
    sidebarIndex: buildSidebarSearchIndex(sidebarInput),
    settingsIndex: buildSettingsSearchIndex(),
    pluginsIndex: buildPluginCatalogSearchIndex(plugins),
    installedPluginsIndex: buildInstalledPluginSearchIndex(installedPlugins),
    sidebarInput,
    plugins,
    installedPlugins
  };
}

describe('mergeSearchHitsRoundRobin', () => {
  it('interleaves hits across domains up to the cap', () => {
    const grouped: Record<SearchDomain, UnifiedSearchHit[]> = {
      collection: [{ domain: 'collection', id: 'collection:1', title: 'A', score: 1 }],
      folder: [{ domain: 'folder', id: 'folder:10', title: 'B', score: 1 }],
      request: [{ domain: 'request', id: 'request:100', title: 'C', score: 1 }],
      environment: [{ domain: 'environment', id: 'environment:200', title: 'D', score: 1 }],
      setting: [{ domain: 'setting', id: 'proxy.enabled', title: 'E', score: 1 }],
      page: [{ domain: 'page', id: 'snippets', title: 'H', score: 1 }],
      plugin: [{ domain: 'plugin', id: 'com.example.curl', title: 'F', score: 1 }],
      theme: [{ domain: 'theme', id: 'com.example.nord', title: 'G', score: 1 }]
    };

    const merged = mergeSearchHitsRoundRobin(grouped, 4);
    expect(merged.map((hit) => hit.domain)).toEqual([
      'collection',
      'folder',
      'request',
      'environment'
    ]);
  });
});

describe('searchAll', () => {
  it('returns an empty list for an empty query', () => {
    expect(searchAll('', buildContext())).toEqual([]);
    expect(searchAll('   ', buildContext())).toEqual([]);
  });

  it('returns hits from multiple domains', () => {
    const hits = searchAll('proxy', buildContext());
    expect(hits.some((hit) => hit.domain === 'setting')).toBe(true);
  });

  it('returns snippets page hits from the page domain', () => {
    const hits = searchAll('snippets', buildContext());
    expect(hits.some((hit) => hit.domain === 'page' && hit.id === 'snippets')).toBe(true);
  });

  it('assigns theme catalog entries to the theme domain', () => {
    const hits = searchAll('nord', buildContext());
    expect(hits.some((hit) => hit.domain === 'theme' && hit.id === 'com.example.nord')).toBe(true);
  });

  it('assigns non-theme catalog entries to the plugin domain', () => {
    const hits = searchAll('curl', buildContext());
    expect(hits.some((hit) => hit.domain === 'plugin' && hit.id === 'com.example.curl')).toBe(true);
    expect(hits.some((hit) => hit.id === 'com.example.curl' && hit.domain === 'theme')).toBe(false);
  });

  it('assigns installed theme plugins to the theme domain with installed source', () => {
    const hits = searchAll('nord', buildContext());
    expect(
      hits.some(
        (hit) =>
          hit.domain === 'theme' &&
          hit.id === 'com.example.nord' &&
          hit.pluginListingSource === 'installed'
      )
    ).toBe(true);
  });

  it('assigns marketplace catalog entries with marketplace source', () => {
    const hits = searchAll('curl', buildContext());
    expect(
      hits.some(
        (hit) =>
          hit.domain === 'plugin' &&
          hit.id === 'com.example.curl' &&
          hit.pluginListingSource === 'marketplace'
      )
    ).toBe(true);
  });

  it('can return the same plugin id from installed and marketplace sources', () => {
    const hits = searchAll('curl', buildContext());
    const curlHits = hits.filter((hit) => hit.id === 'com.example.curl');
    expect(curlHits.some((hit) => hit.pluginListingSource === 'installed')).toBe(true);
    expect(curlHits.some((hit) => hit.pluginListingSource === 'marketplace')).toBe(true);
  });

  it('caps results at SEARCH_ANYTHING_MAX_RESULTS', () => {
    const manyHits: UnifiedSearchHit[] = Array.from({ length: 20 }, (_, index) => ({
      domain: 'setting',
      id: `setting-${index}`,
      title: `Setting ${index}`,
      score: 1
    }));

    const grouped: Record<SearchDomain, UnifiedSearchHit[]> = {
      collection: [],
      folder: [],
      request: [],
      environment: [],
      setting: manyHits,
      page: [],
      plugin: [],
      theme: []
    };

    expect(mergeSearchHitsRoundRobin(grouped, SEARCH_ANYTHING_MAX_RESULTS)).toHaveLength(
      SEARCH_ANYTHING_MAX_RESULTS
    );
  });
});
