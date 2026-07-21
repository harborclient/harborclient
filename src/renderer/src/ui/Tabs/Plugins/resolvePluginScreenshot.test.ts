import { describe, expect, it, vi } from 'vitest';
import type { PluginCatalogEntry } from '#/shared/plugin/catalog';
import type { PluginGitPreview, PluginInfo } from '#/shared/plugin/types';
import {
  loadInstalledPluginScreenshotSrcs,
  pluginAssetToDataUrl,
  resolveCatalogPluginScreenshotSrcs
} from './resolvePluginScreenshot';

const sampleEntry: PluginCatalogEntry = {
  id: 'com.example.demo',
  name: 'Demo Plugin',
  version: '1.0.0',
  summary: 'A sample plugin.',
  author: 'Example Inc.',
  categories: ['requests'],
  repoUrl: 'https://github.com/example/demo-plugin',
  screenshot: 'https://example.com/screenshot.png'
};

const installedPlugin: PluginInfo = {
  id: sampleEntry.id,
  name: sampleEntry.name,
  version: sampleEntry.version,
  source: 'git',
  enabled: true,
  path: '/tmp/demo-plugin',
  permissions: ['ui'],
  repoUrl: sampleEntry.repoUrl,
  repoRef: 'main',
  manifest: {
    id: sampleEntry.id,
    name: sampleEntry.name,
    version: sampleEntry.version,
    engines: { harborclient: '>=1.8.0' },
    permissions: ['ui']
  }
};

describe('pluginAssetToDataUrl', () => {
  it('builds a data URL from a plugin asset payload', () => {
    expect(
      pluginAssetToDataUrl({
        content: 'abc',
        mimeType: 'image/png'
      })
    ).toBe('data:image/png;base64,abc');
  });
});

describe('resolveCatalogPluginScreenshotSrcs', () => {
  it('prefers git preview screenshots over catalog URLs', () => {
    const preview: PluginGitPreview = {
      manifest: installedPlugin.manifest,
      screenshotSrcs: ['data:image/png;base64,preview']
    };

    expect(resolveCatalogPluginScreenshotSrcs(sampleEntry, preview)).toEqual([
      'data:image/png;base64,preview'
    ]);
  });

  it('uses plural catalog screenshots when preview is unavailable', () => {
    expect(
      resolveCatalogPluginScreenshotSrcs(
        {
          ...sampleEntry,
          screenshots: ['https://example.com/a.png', 'https://example.com/b.png']
        },
        null
      )
    ).toEqual(['https://example.com/a.png', 'https://example.com/b.png']);
  });

  it('falls back to singular catalog screenshot', () => {
    expect(resolveCatalogPluginScreenshotSrcs(sampleEntry, null)).toEqual([
      'https://example.com/screenshot.png'
    ]);
  });

  it('resolves relative catalog screenshot paths against the listing repo', () => {
    expect(
      resolveCatalogPluginScreenshotSrcs(
        {
          ...sampleEntry,
          ref: 'v1.0.2',
          screenshot: undefined,
          screenshots: ['screenshot.png']
        },
        null
      )
    ).toEqual(['https://raw.githubusercontent.com/example/demo-plugin/v1.0.2/screenshot.png']);
  });
});

describe('loadInstalledPluginScreenshotSrcs', () => {
  it('loads manifest screenshots from plugin assets on disk', async () => {
    const readPluginAsset = vi.fn(async () => ({
      content: 'abc',
      mimeType: 'image/png'
    }));
    vi.stubGlobal('window', {
      api: { readPluginAsset }
    });

    const plugin: PluginInfo = {
      ...installedPlugin,
      manifest: {
        ...installedPlugin.manifest,
        screenshots: ['assets/one.png', 'assets/two.png']
      }
    };

    await expect(loadInstalledPluginScreenshotSrcs(plugin)).resolves.toEqual([
      'data:image/png;base64,abc',
      'data:image/png;base64,abc'
    ]);
    expect(readPluginAsset).toHaveBeenCalledTimes(2);
  });

  it('passes through absolute manifest screenshot URLs', async () => {
    vi.stubGlobal('window', {
      api: { readPluginAsset: vi.fn(async () => ({ content: '', mimeType: 'image/png' })) }
    });

    const absoluteUrl = 'https://example.com/remote.png';
    const plugin: PluginInfo = {
      ...installedPlugin,
      manifest: {
        ...installedPlugin.manifest,
        screenshots: [absoluteUrl]
      }
    };

    await expect(loadInstalledPluginScreenshotSrcs(plugin)).resolves.toEqual([absoluteUrl]);
  });

  it('re-resolves stale raw GitHub manifest screenshot URLs against the installed repo', async () => {
    vi.stubGlobal('window', {
      api: {
        readPluginAsset: vi.fn(async () => {
          throw new Error('missing asset');
        })
      }
    });

    const plugin: PluginInfo = {
      ...installedPlugin,
      repoUrl: 'https://github.com/harborclient/theme-ayu-mirage',
      repoRef: 'v1.0.2',
      manifest: {
        ...installedPlugin.manifest,
        screenshots: [
          'https://raw.githubusercontent.com/harborclient/plugin-ayu-mirage/main/screenshot.png'
        ]
      }
    };

    await expect(loadInstalledPluginScreenshotSrcs(plugin)).resolves.toEqual([
      'https://raw.githubusercontent.com/harborclient/theme-ayu-mirage/v1.0.2/screenshot.png'
    ]);
  });

  it('loads stale raw GitHub manifest screenshots from disk when the asset exists', async () => {
    const readPluginAsset = vi.fn(async () => ({
      content: 'abc',
      mimeType: 'image/png'
    }));
    vi.stubGlobal('window', {
      api: { readPluginAsset }
    });

    const plugin: PluginInfo = {
      ...installedPlugin,
      manifest: {
        ...installedPlugin.manifest,
        screenshots: [
          'https://raw.githubusercontent.com/harborclient/plugin-ayu-mirage/main/screenshot.png'
        ]
      }
    };

    await expect(loadInstalledPluginScreenshotSrcs(plugin)).resolves.toEqual([
      'data:image/png;base64,abc'
    ]);
    expect(readPluginAsset).toHaveBeenCalledWith(plugin.id, 'screenshot.png');
  });

  it('falls back to catalog screenshots when manifest assets are unavailable', async () => {
    vi.stubGlobal('window', {
      api: {
        readPluginAsset: vi.fn(async () => {
          throw new Error('missing asset');
        })
      }
    });

    await expect(
      loadInstalledPluginScreenshotSrcs(
        installedPlugin,
        ['https://example.com/a.png', 'https://example.com/b.png'],
        'https://example.com/single.png'
      )
    ).resolves.toEqual(['https://example.com/a.png', 'https://example.com/b.png']);
  });

  it('resolves relative catalog screenshot paths for installed plugins', async () => {
    vi.stubGlobal('window', {
      api: {
        readPluginAsset: vi.fn(async () => {
          throw new Error('missing asset');
        })
      }
    });

    await expect(
      loadInstalledPluginScreenshotSrcs(installedPlugin, ['screenshot.png'])
    ).resolves.toEqual([
      'https://raw.githubusercontent.com/example/demo-plugin/main/screenshot.png'
    ]);
  });
});
