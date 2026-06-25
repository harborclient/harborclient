import { describe, expect, it } from 'vitest';
import { parsePluginCatalog, parsePluginTrustedKeys } from '#/shared/plugin/catalog';

const validCatalog = {
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
