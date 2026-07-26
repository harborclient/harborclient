import { describe, expect, it } from 'vitest';
import type { PluginCatalogEntry } from '@harborclient/core/plugin/catalog';
import type { PluginInfo } from '@harborclient/core/plugin/types';
import { installedPluginScreenshotIdentity } from './installedPluginScreenshotIdentity';

/**
 * Builds a minimal installed plugin row for screenshot identity tests.
 *
 * @param overrides - Fields to merge onto the base plugin row.
 */
function pluginInfo(overrides: Partial<PluginInfo> = {}): PluginInfo {
  return {
    id: 'com.example.test',
    name: 'Test',
    version: '1.0.0',
    enabled: true,
    path: '/tmp/test',
    source: 'installed',
    permissions: [],
    manifest: {
      id: 'com.example.test',
      name: 'Test',
      version: '1.0.0',
      engines: { harborclient: '>=1.0.0' },
      permissions: [],
      screenshots: ['screenshot.png']
    },
    ...overrides
  };
}

describe('installedPluginScreenshotIdentity', () => {
  it('stays stable when only enablement changes', () => {
    const enabled = pluginInfo({ enabled: true });
    const disabled = pluginInfo({ enabled: false });

    expect(installedPluginScreenshotIdentity(enabled)).toBe(
      installedPluginScreenshotIdentity(disabled)
    );
  });

  it('changes when screenshot paths or version change', () => {
    const base = pluginInfo();
    const nextVersion = pluginInfo({ version: '1.0.1' });
    const nextScreenshots = pluginInfo({
      manifest: {
        ...base.manifest,
        screenshots: ['other.png']
      }
    });

    expect(installedPluginScreenshotIdentity(base)).not.toBe(
      installedPluginScreenshotIdentity(nextVersion)
    );
    expect(installedPluginScreenshotIdentity(base)).not.toBe(
      installedPluginScreenshotIdentity(nextScreenshots)
    );
  });

  it('includes catalog screenshot URLs in the identity', () => {
    const plugin = pluginInfo();
    const catalog: PluginCatalogEntry = {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      summary: 'Summary',
      author: 'Example Inc.',
      categories: ['requests'],
      repoUrl: 'https://github.com/example/test',
      ref: 'main',
      screenshots: ['https://example.com/a.png']
    };
    const otherCatalog: PluginCatalogEntry = {
      ...catalog,
      screenshots: ['https://example.com/b.png']
    };

    expect(installedPluginScreenshotIdentity(plugin, catalog)).not.toBe(
      installedPluginScreenshotIdentity(plugin, otherCatalog)
    );
  });
});
