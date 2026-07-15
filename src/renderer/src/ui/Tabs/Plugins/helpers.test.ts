import { describe, expect, it, vi } from 'vitest';
import type { PluginCatalog, PluginCatalogEntry } from '#/shared/plugin/catalog';
import type { PluginInfo } from '#/shared/plugin/types';
import {
  installedPluginInstallationLabel,
  resolvePendingPluginInstallDeepLink,
  resolveInstalledPluginSummary
} from '#/renderer/src/ui/Tabs/Plugins/helpers';

const sampleEntry: PluginCatalogEntry = {
  id: 'com.harborclient.plugins.curl',
  name: 'cURL',
  version: '1.0.6',
  summary: 'Shows a curl command for the configured request.',
  author: 'HarborClient',
  categories: ['requests'],
  repoUrl: 'https://github.com/harborclient/plugin-curl'
};

const sampleCatalog: PluginCatalog = {
  schemaVersion: 1,
  plugins: [sampleEntry]
};

describe('resolvePendingPluginInstallDeepLink', () => {
  it('asks for confirmation before installing an uninstalled plugin', async () => {
    const confirmInstall = vi.fn(async () => true);
    const installFromGit = vi.fn(async () => ({ id: sampleEntry.id }) as PluginInfo);

    const result = await resolvePendingPluginInstallDeepLink(sampleEntry.id, {
      getPluginCatalog: async () => sampleCatalog,
      listPlugins: async () => [],
      confirmInstall,
      installFromGit,
      isCancelled: () => false
    });

    expect(confirmInstall).toHaveBeenCalledOnce();
    expect(confirmInstall).toHaveBeenCalledWith(sampleEntry);
    expect(installFromGit).toHaveBeenCalledOnce();
    expect(result).toEqual({ kind: 'installed', plugin: { id: sampleEntry.id } });
  });

  it('does not install when the user declines confirmation', async () => {
    const installFromGit = vi.fn(async () => ({ id: sampleEntry.id }) as PluginInfo);

    const result = await resolvePendingPluginInstallDeepLink(sampleEntry.id, {
      getPluginCatalog: async () => sampleCatalog,
      listPlugins: async () => [],
      confirmInstall: async () => false,
      installFromGit,
      isCancelled: () => false
    });

    expect(installFromGit).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: 'declined' });
  });

  it('returns already-installed when the plugin id is present locally', async () => {
    const installed: PluginInfo = {
      id: sampleEntry.id,
      name: sampleEntry.name,
      version: sampleEntry.version,
      source: 'git',
      path: '/tmp/plugin',
      enabled: true,
      permissions: [],
      manifest: {
        id: sampleEntry.id,
        name: sampleEntry.name,
        version: sampleEntry.version,
        main: 'index.js',
        engines: { harborclient: '>=1.0.0' },
        permissions: []
      }
    };

    const result = await resolvePendingPluginInstallDeepLink(sampleEntry.id, {
      getPluginCatalog: async () => sampleCatalog,
      listPlugins: async () => [installed],
      confirmInstall: async () => true,
      installFromGit: async () => installed,
      isCancelled: () => false
    });

    expect(result).toEqual({ kind: 'already-installed', plugin: installed });
  });
});

describe('resolveInstalledPluginSummary', () => {
  const basePlugin: PluginInfo = {
    id: sampleEntry.id,
    name: sampleEntry.name,
    version: sampleEntry.version,
    source: 'git',
    path: '/tmp/plugin',
    enabled: true,
    permissions: [],
    manifest: {
      id: sampleEntry.id,
      name: sampleEntry.name,
      version: sampleEntry.version,
      main: 'index.js',
      engines: { harborclient: '>=1.0.0' },
      permissions: []
    }
  };

  it('prefers manifest summary over catalog summary', () => {
    const plugin: PluginInfo = {
      ...basePlugin,
      manifest: { ...basePlugin.manifest, summary: 'From manifest.' }
    };

    expect(resolveInstalledPluginSummary(plugin, sampleEntry)).toBe('From manifest.');
  });

  it('falls back to catalog summary when manifest omits summary', () => {
    expect(resolveInstalledPluginSummary(basePlugin, sampleEntry)).toBe(sampleEntry.summary);
  });

  it('returns undefined when neither manifest nor catalog provides a summary', () => {
    expect(resolveInstalledPluginSummary(basePlugin)).toBeUndefined();
  });
});

describe('installedPluginInstallationLabel', () => {
  it('maps plugin source values to detail modal labels', () => {
    expect(installedPluginInstallationLabel('git')).toBe('Git');
    expect(installedPluginInstallationLabel('unpacked')).toBe('Development');
    expect(installedPluginInstallationLabel('installed')).toBe('File');
  });
});
