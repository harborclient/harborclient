import { describe, expect, it } from 'vitest';
import {
  getDefaultPluginSources,
  isHarborClientEndpoint,
  normalizePluginSources,
  parsePluginCatalog,
  parsePluginTrustedKeys,
  PLUGIN_CATALOG_URL,
  PLUGIN_TRUSTED_KEYS_URL
} from './catalog';

const validCatalog = {
  schemaVersion: 1 as const,
  plugins: [
    {
      id: 'com.example.demo',
      name: 'Demo Plugin',
      version: '1.0.0',
      summary: 'A sample plugin for tests.',
      author: 'Example Inc.',
      categories: ['editor'],
      repoUrl: 'https://github.com/example/demo-plugin'
    }
  ]
};

describe('parsePluginCatalog', () => {
  it('accepts a valid catalog payload', () => {
    expect(parsePluginCatalog(validCatalog)).toEqual(validCatalog);
  });

  it('accepts optional icon and screenshot URLs', () => {
    expect(
      parsePluginCatalog({
        ...validCatalog,
        plugins: [
          {
            ...validCatalog.plugins[0],
            icon: 'https://example.com/icon.png',
            screenshot: 'https://example.com/screenshot.png'
          }
        ]
      })
    ).toEqual({
      ...validCatalog,
      plugins: [
        {
          ...validCatalog.plugins[0],
          icon: 'https://example.com/icon.png',
          screenshot: 'https://example.com/screenshot.png'
        }
      ]
    });
  });

  it('accepts optional plural screenshot URLs', () => {
    expect(
      parsePluginCatalog({
        ...validCatalog,
        plugins: [
          {
            ...validCatalog.plugins[0],
            screenshots: ['https://example.com/a.png', 'https://example.com/b.png']
          }
        ]
      })
    ).toEqual({
      ...validCatalog,
      plugins: [
        {
          ...validCatalog.plugins[0],
          screenshots: ['https://example.com/a.png', 'https://example.com/b.png']
        }
      ]
    });
  });

  it('accepts repository-relative screenshot paths', () => {
    expect(
      parsePluginCatalog({
        ...validCatalog,
        plugins: [
          {
            ...validCatalog.plugins[0],
            screenshot: 'screenshot.png',
            screenshots: ['screenshot.png', 'assets/preview.png']
          }
        ]
      })
    ).toEqual({
      ...validCatalog,
      plugins: [
        {
          ...validCatalog.plugins[0],
          screenshot: 'screenshot.png',
          screenshots: ['screenshot.png', 'assets/preview.png']
        }
      ]
    });
  });

  it('accepts optional theme contributions copied from manifests', () => {
    expect(
      parsePluginCatalog({
        schemaVersion: 1,
        plugins: [
          {
            id: 'com.example.theme',
            name: 'Theme',
            version: '1.0.0',
            summary: 'A theme plugin.',
            author: 'Example Inc.',
            categories: ['themes'],
            repoUrl: 'https://github.com/example/theme',
            contributes: {
              themes: [{ id: 'latte', title: 'Latte', type: 'light' }]
            }
          }
        ]
      })
    ).toEqual({
      schemaVersion: 1,
      plugins: [
        {
          id: 'com.example.theme',
          name: 'Theme',
          version: '1.0.0',
          summary: 'A theme plugin.',
          author: 'Example Inc.',
          categories: ['themes'],
          repoUrl: 'https://github.com/example/theme',
          contributes: {
            themes: [{ id: 'latte', title: 'Latte', type: 'light' }]
          }
        }
      ]
    });
  });

  it('accepts optional description markdown with plural screenshots', () => {
    expect(
      parsePluginCatalog({
        ...validCatalog,
        plugins: [
          {
            ...validCatalog.plugins[0],
            screenshots: ['https://example.com/a.png'],
            description: '# Demo Plugin\n\nAdds a sidebar panel for API audit checks.'
          }
        ]
      })
    ).toEqual({
      ...validCatalog,
      plugins: [
        {
          ...validCatalog.plugins[0],
          screenshots: ['https://example.com/a.png'],
          description: '# Demo Plugin\n\nAdds a sidebar panel for API audit checks.'
        }
      ]
    });
  });

  it('rejects an empty description string', () => {
    expect(() =>
      parsePluginCatalog({
        ...validCatalog,
        plugins: [
          {
            ...validCatalog.plugins[0],
            description: ''
          }
        ]
      })
    ).toThrow();
  });

  it('rejects non-GitHub repository URLs', () => {
    expect(() =>
      parsePluginCatalog({
        schemaVersion: 1,
        plugins: [
          {
            ...validCatalog.plugins[0],
            repoUrl: 'https://gitlab.com/example/demo-plugin'
          }
        ]
      })
    ).toThrow(/github\.com/);
  });

  it('strips unknown categories and keeps recognized ones', () => {
    expect(
      parsePluginCatalog({
        schemaVersion: 1,
        plugins: [
          {
            ...validCatalog.plugins[0],
            categories: ['requests', 'unknown-category', 'requests']
          }
        ]
      })
    ).toEqual({
      schemaVersion: 1,
      plugins: [
        {
          ...validCatalog.plugins[0],
          categories: ['requests']
        }
      ]
    });
  });

  it('keeps plugins when every category is unknown', () => {
    expect(
      parsePluginCatalog({
        schemaVersion: 1,
        plugins: [
          {
            ...validCatalog.plugins[0],
            categories: ['unknown-category', 'also-unknown']
          }
        ]
      })
    ).toEqual({
      schemaVersion: 1,
      plugins: [
        {
          ...validCatalog.plugins[0],
          categories: []
        }
      ]
    });
  });

  it('rejects duplicate plugin ids', () => {
    expect(() =>
      parsePluginCatalog({
        schemaVersion: 1,
        plugins: [validCatalog.plugins[0], validCatalog.plugins[0]]
      })
    ).toThrow(/duplicate id/i);
  });
});

const validTrustedKeys = [
  {
    author: 'HarborClient',
    key: 'https://harborclient.com/plugins/harborclient.key'
  }
];

describe('parsePluginTrustedKeys', () => {
  it('accepts a valid trusted keys payload', () => {
    expect(parsePluginTrustedKeys(validTrustedKeys)).toEqual(validTrustedKeys);
  });

  it('rejects duplicate key URLs', () => {
    expect(() =>
      parsePluginTrustedKeys([
        validTrustedKeys[0],
        {
          author: 'Other',
          key: 'https://harborclient.com/plugins/harborclient.key'
        }
      ])
    ).toThrow(/duplicate key url/i);
  });

  it('rejects invalid key URLs', () => {
    expect(() =>
      parsePluginTrustedKeys([
        {
          author: 'HarborClient',
          key: 'not-a-url'
        }
      ])
    ).toThrow();
  });
});

describe('plugin source settings helpers', () => {
  it('returns HarborClient defaults with both endpoints enabled', () => {
    expect(getDefaultPluginSources()).toEqual({
      catalogs: [{ url: PLUGIN_CATALOG_URL, enabled: true }],
      trusted: [{ url: PLUGIN_TRUSTED_KEYS_URL, enabled: true }]
    });
  });

  it('dedupes plugin source URLs while preserving the first row', () => {
    expect(
      normalizePluginSources({
        catalogs: [
          { url: 'https://example.com/catalog.json', enabled: true },
          { url: 'https://example.com/catalog.json', enabled: false }
        ],
        trusted: [{ url: 'https://example.com/trusted.json', enabled: true }]
      })
    ).toEqual({
      catalogs: [{ url: 'https://example.com/catalog.json', enabled: true }],
      trusted: [{ url: 'https://example.com/trusted.json', enabled: true }]
    });
  });

  it('returns defaults when both lists are empty after normalization', () => {
    expect(
      normalizePluginSources({
        catalogs: [],
        trusted: []
      })
    ).toEqual(getDefaultPluginSources());
  });

  it('identifies harborclient.com endpoints and subdomains', () => {
    expect(isHarborClientEndpoint(PLUGIN_CATALOG_URL)).toBe(true);
    expect(isHarborClientEndpoint('https://cdn.harborclient.com/plugin_catalog.json')).toBe(true);
    expect(isHarborClientEndpoint('https://example.com/catalog.json')).toBe(false);
    expect(isHarborClientEndpoint('not-a-url')).toBe(false);
  });
});
