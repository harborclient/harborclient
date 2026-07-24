import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocalDatabase } from '#/main/storage/LocalDatabase';
import {
  clearLocalDatabaseForTesting,
  setLocalDatabaseForTesting
} from '#/main/storage/localDatabaseInstance';
import { PLUGIN_CATALOG_URL } from '#/shared/plugin/catalog';
import {
  getCachedTeamHubCatalogs,
  mergeEnabledPluginUrls,
  refreshTeamHubPluginSources
} from './teamHubPluginSources';
import { getEnabledCatalogUrls, setPluginSources } from './pluginSourcesSettings';

const hubOne = {
  id: 'hub-1',
  name: 'Corp Hub',
  baseUrl: 'http://127.0.0.1:8788',
  token: 'hbk_test'
};

vi.mock('#/main/settings/teamHubSettings', () => ({
  listTeamHubs: vi.fn(() => [hubOne])
}));

vi.mock('@harborclient/team-hub-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@harborclient/team-hub-api')>()),
  TeamHubClient: class MockTeamHubClient {
    /**
     * Returns plugin source URLs configured on the mocked Team Hub.
     */
    getPluginSources = vi.fn().mockResolvedValue({
      catalogs: ['https://hub.example/catalog.json'],
      trusted: ['https://hub.example/trusted.json']
    });
  }
}));

describe('teamHubPluginSources', () => {
  let settingsStore: Record<string, string>;

  beforeEach(() => {
    settingsStore = {};
    const database = {
      getSetting: (key: string) => settingsStore[key],
      setSetting: (key: string, value: string) => {
        settingsStore[key] = value;
      }
    } as LocalDatabase;
    setLocalDatabaseForTesting(database);
  });

  afterEach(() => {
    clearLocalDatabaseForTesting();
    vi.clearAllMocks();
  });

  it('mergeEnabledPluginUrls appends unique hub URLs after user URLs', () => {
    expect(
      mergeEnabledPluginUrls(
        [PLUGIN_CATALOG_URL, 'https://example.com/catalog.json'],
        [PLUGIN_CATALOG_URL, 'https://hub.example/catalog.json']
      )
    ).toEqual([
      PLUGIN_CATALOG_URL,
      'https://example.com/catalog.json',
      'https://hub.example/catalog.json'
    ]);
  });

  it('refreshTeamHubPluginSources caches hub plugin source URLs', async () => {
    const view = await refreshTeamHubPluginSources();

    expect(view).toEqual({
      catalogs: [
        {
          hubId: 'hub-1',
          hubName: 'Corp Hub',
          url: 'https://hub.example/catalog.json'
        }
      ],
      trusted: [
        {
          hubId: 'hub-1',
          hubName: 'Corp Hub',
          url: 'https://hub.example/trusted.json'
        }
      ]
    });
    expect(getCachedTeamHubCatalogs()).toEqual(view.catalogs);
  });

  it('getEnabledCatalogUrls merges cached Team Hub catalog URLs after user URLs', async () => {
    setPluginSources({
      catalogs: [{ url: PLUGIN_CATALOG_URL, enabled: true }],
      trusted: []
    });
    await refreshTeamHubPluginSources();

    expect(getEnabledCatalogUrls()).toEqual([
      PLUGIN_CATALOG_URL,
      'https://hub.example/catalog.json'
    ]);
  });
});
