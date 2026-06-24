import { describe, expect, it } from 'vitest';
import { parsePluginCatalog } from '#/shared/plugin/catalog';

const validCatalog = {
  schemaVersion: 1 as const,
  plugins: [
    {
      id: 'com.example.demo',
      name: 'Demo Plugin',
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
