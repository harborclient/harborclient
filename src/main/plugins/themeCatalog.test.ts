import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_CATALOG_URL } from '#/shared/plugin/catalog';

const sampleThemeCatalog = {
  schemaVersion: 1 as const,
  themes: [
    {
      id: 'com.example.theme',
      name: 'Demo Theme',
      version: '1.0.0',
      summary: 'A sample theme for tests.',
      author: 'Example Inc.',
      categories: ['themes'],
      repoUrl: 'https://github.com/example/demo-theme',
      contributes: {
        themes: [{ id: 'demo', title: 'Demo', type: 'dark' as const }]
      }
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
 * Creates a temporary app root containing plugins/theme_catalog.json for tests.
 *
 * @returns Absolute path to the temporary app root directory.
 */
function createAppRootWithThemeCatalog(): string {
  const root = mkdtempSync(join(tmpdir(), 'harborclient-theme-catalog-'));
  const pluginsDir = join(root, 'plugins');
  mkdirSync(pluginsDir, { recursive: true });
  writeFileSync(
    join(pluginsDir, 'theme_catalog.json'),
    `${JSON.stringify(sampleThemeCatalog, null, 2)}\n`,
    'utf8'
  );
  return root;
}

describe('themeCatalog', () => {
  beforeEach(async () => {
    vi.resetModules();
    appRoot = createAppRootWithThemeCatalog();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (appRoot) {
      rmSync(appRoot, { recursive: true, force: true });
      appRoot = '';
    }
  });

  it('readLocalThemeCatalog returns a parsed catalog from the app root', async () => {
    const { readLocalThemeCatalog } = await import('#/main/plugins/themeCatalog');
    expect(readLocalThemeCatalog()).toEqual(sampleThemeCatalog);
  });

  it('fetchThemeCatalog returns the remote catalog when the HTTP request succeeds', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(sampleThemeCatalog), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const { fetchThemeCatalog } = await import('#/main/plugins/themeCatalog');
    await expect(fetchThemeCatalog()).resolves.toEqual(sampleThemeCatalog);
    expect(globalThis.fetch).toHaveBeenCalledWith(THEME_CATALOG_URL, {
      headers: { Accept: 'application/json' }
    });
  });

  it('fetchThemeCatalog falls back to the local catalog when the remote request returns 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }));

    const { fetchThemeCatalog } = await import('#/main/plugins/themeCatalog');
    await expect(fetchThemeCatalog()).resolves.toEqual(sampleThemeCatalog);
  });

  it('fetchThemeCatalog throws when both remote and local catalogs are unavailable', async () => {
    rmSync(join(appRoot, 'plugins'), { recursive: true, force: true });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }));

    const { fetchThemeCatalog } = await import('#/main/plugins/themeCatalog');
    await expect(fetchThemeCatalog()).rejects.toThrow(/no local catalog was found/i);
  });

  it('readLocalThemeCatalog accepts rich themes embedded in catalog.json', async () => {
    rmSync(join(appRoot, 'plugins', 'theme_catalog.json'), { force: true });
    writeFileSync(
      join(appRoot, 'plugins', 'catalog.json'),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          plugins: [],
          themes: sampleThemeCatalog.themes
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const { readLocalThemeCatalog } = await import('#/main/plugins/themeCatalog');
    expect(readLocalThemeCatalog()).toEqual({
      schemaVersion: 1,
      themes: sampleThemeCatalog.themes
    });
  });

  it('readLocalThemeCatalog skips thin source theme rows without id/name', async () => {
    rmSync(join(appRoot, 'plugins', 'theme_catalog.json'), { force: true });
    writeFileSync(
      join(appRoot, 'plugins', 'catalog.json'),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          plugins: [],
          themes: [
            {
              repoUrl: 'https://github.com/example/demo-theme',
              ref: 'v1.0.0'
            }
          ]
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const { readLocalThemeCatalog } = await import('#/main/plugins/themeCatalog');
    expect(readLocalThemeCatalog()).toBeNull();
  });
});
