import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LocalDatabase } from '#/main/storage/LocalDatabase';
import {
  clearLocalDatabaseForTesting,
  setLocalDatabaseForTesting
} from '#/main/storage/localDatabaseInstance';
import {
  getDefaultPluginSources,
  PLUGIN_CATALOG_URL,
  PLUGIN_TRUSTED_KEYS_URL
} from '#/shared/plugin/catalog';
import {
  getEnabledCatalogUrls,
  getEnabledTrustedUrls,
  getPluginSources,
  setPluginSources
} from './pluginSourcesSettings';

describe('pluginSourcesSettings', () => {
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
  });

  it('returns HarborClient defaults when nothing is stored', () => {
    expect(getPluginSources()).toEqual(getDefaultPluginSources());
  });

  it('persists and normalizes custom plugin source settings', () => {
    const saved = setPluginSources({
      catalogs: [{ url: 'https://example.com/catalog.json', enabled: true }],
      trusted: [{ url: 'https://example.com/trusted.json', enabled: false }]
    });

    expect(saved).toEqual({
      catalogs: [{ url: 'https://example.com/catalog.json', enabled: true }],
      trusted: [{ url: 'https://example.com/trusted.json', enabled: false }]
    });
    expect(getPluginSources()).toEqual(saved);
  });

  it('returns only enabled catalog and trusted URLs in order', () => {
    setPluginSources({
      catalogs: [
        { url: PLUGIN_CATALOG_URL, enabled: true },
        { url: 'https://example.com/catalog.json', enabled: false },
        { url: 'https://corp.example/catalog.json', enabled: true }
      ],
      trusted: [
        { url: PLUGIN_TRUSTED_KEYS_URL, enabled: false },
        { url: 'https://example.com/trusted.json', enabled: true }
      ]
    });

    expect(getEnabledCatalogUrls()).toEqual([
      PLUGIN_CATALOG_URL,
      'https://corp.example/catalog.json'
    ]);
    expect(getEnabledTrustedUrls()).toEqual(['https://example.com/trusted.json']);
  });
});
