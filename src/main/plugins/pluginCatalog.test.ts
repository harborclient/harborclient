import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PLUGIN_CATALOG_URL } from '#/shared/plugin/catalog';

const sampleCatalog = {
  schemaVersion: 1 as const,
  plugins: [
    {
      id: 'com.example.demo',
      name: 'Demo Plugin',
      version: '1.0.0',
      summary: 'A sample plugin for tests.',
      author: 'Example Inc.',
      categories: ['utilities'],
      repoUrl: 'https://github.com/example/demo-plugin'
    }
  ]
};

let appRoot = '';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => appRoot
  }
}));

/**
 * Creates a temporary app root containing plugins/catalog.json for tests.
 *
 * @returns Absolute path to the temporary app root directory.
 */
function createAppRootWithCatalog(): string {
  const root = mkdtempSync(join(tmpdir(), 'harborclient-plugin-catalog-'));
  const pluginsDir = join(root, 'plugins');
  mkdirSync(pluginsDir, { recursive: true });
  writeFileSync(
    join(pluginsDir, 'catalog.json'),
    `${JSON.stringify(sampleCatalog, null, 2)}\n`,
    'utf8'
  );
  return root;
}

describe('pluginCatalog', () => {
  beforeEach(async () => {
    vi.resetModules();
    appRoot = createAppRootWithCatalog();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (appRoot) {
      rmSync(appRoot, { recursive: true, force: true });
      appRoot = '';
    }
  });

  it('readLocalPluginCatalog returns a parsed catalog from the app root', async () => {
    const { readLocalPluginCatalog } = await import('#/main/plugins/pluginCatalog');
    expect(readLocalPluginCatalog()).toEqual(sampleCatalog);
  });

  it('fetchPluginCatalog returns the remote catalog when the HTTP request succeeds', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(sampleCatalog), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const { fetchPluginCatalog } = await import('#/main/plugins/pluginCatalog');
    await expect(fetchPluginCatalog()).resolves.toEqual(sampleCatalog);
    expect(globalThis.fetch).toHaveBeenCalledWith(PLUGIN_CATALOG_URL, {
      headers: { Accept: 'application/json' }
    });
  });

  it('fetchPluginCatalog falls back to the local catalog when the remote request returns 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }));

    const { fetchPluginCatalog } = await import('#/main/plugins/pluginCatalog');
    await expect(fetchPluginCatalog()).resolves.toEqual(sampleCatalog);
  });

  it('fetchPluginCatalog throws when both remote and local catalogs are unavailable', async () => {
    rmSync(join(appRoot, 'plugins'), { recursive: true, force: true });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }));

    const { fetchPluginCatalog } = await import('#/main/plugins/pluginCatalog');
    await expect(fetchPluginCatalog()).rejects.toThrow(/no local catalog was found/i);
  });
});

describe('readLocalPluginCatalog with explicit paths', () => {
  let tempCatalogPath = '';

  afterEach(() => {
    if (tempCatalogPath) {
      rmSync(join(tempCatalogPath, '..'), { recursive: true, force: true });
      tempCatalogPath = '';
    }
  });

  it('returns null when no candidate path exists', async () => {
    const { readLocalPluginCatalog } = await import('#/main/plugins/pluginCatalog');
    expect(readLocalPluginCatalog(['/tmp/does-not-exist/catalog.json'])).toBeNull();
  });

  it('returns a parsed catalog for an explicit path override', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'harborclient-plugin-catalog-'));
    tempCatalogPath = join(dir, 'catalog.json');
    writeFileSync(tempCatalogPath, `${JSON.stringify(sampleCatalog, null, 2)}\n`, 'utf8');

    const { readLocalPluginCatalog } = await import('#/main/plugins/pluginCatalog');
    expect(readLocalPluginCatalog([tempCatalogPath])).toEqual(sampleCatalog);
    expect(existsSync(tempCatalogPath)).toBe(true);
  });
});
