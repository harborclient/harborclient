import { describe, expect, it } from 'vitest';
import {
  parsePluginManifest,
  satisfiesHarborClientEngine,
  validatePluginManifest
} from './manifestSchema';

describe('manifestSchema', () => {
  const validManifest = {
    id: 'com.example.test',
    name: 'Test Plugin',
    version: '1.0.0',
    engines: { harborclient: '>=1.0.0' },
    renderer: 'dist/renderer.js',
    permissions: ['ui', 'storage']
  };

  it('parses a valid manifest', () => {
    const manifest = parsePluginManifest(validManifest);
    expect(manifest.id).toBe('com.example.test');
    expect(manifest.permissions).toEqual(['ui', 'storage']);
  });

  it('rejects manifests without renderer, main, or an imported theme', () => {
    expect(() =>
      validatePluginManifest(
        {
          id: 'com.example.test',
          name: 'Test',
          version: '1.0.0',
          engines: { harborclient: '>=1.0.0' },
          permissions: ['ui']
        },
        '1.6.2'
      )
    ).toThrow(/renderer.*main.*imported theme/);
  });

  it('allows manifests with an imported theme and no renderer or main', () => {
    const manifest = validatePluginManifest(
      {
        id: 'com.example.theme-only',
        name: 'Theme Only',
        version: '1.0.0',
        engines: { harborclient: '>=1.0.0' },
        permissions: ['ui'],
        contributes: {
          themes: [
            {
              id: 'solarized',
              title: 'Solarized Dark',
              type: 'dark',
              import: 'exported.json'
            }
          ]
        }
      },
      '1.6.2'
    );
    expect(manifest.contributes?.themes).toEqual([
      {
        id: 'solarized',
        title: 'Solarized Dark',
        type: 'dark',
        import: 'exported.json'
      }
    ]);
  });

  it('checks harborclient engine compatibility', () => {
    expect(satisfiesHarborClientEngine('>=1.6.0', '1.6.2')).toBe(true);
    expect(satisfiesHarborClientEngine('>=1.7.0', '1.6.2')).toBe(false);
  });

  it('parses valid marketplace categories', () => {
    const manifest = parsePluginManifest({
      ...validManifest,
      categories: ['requests', 'utilities']
    });
    expect(manifest.categories).toEqual(['requests', 'utilities']);
  });

  it('parses theme appearance categories alongside themes', () => {
    const manifest = parsePluginManifest({
      ...validManifest,
      categories: ['themes', 'dark']
    });
    expect(manifest.categories).toEqual(['themes', 'dark']);
  });

  it('strips unknown categories and removes duplicates', () => {
    const manifest = parsePluginManifest({
      ...validManifest,
      categories: ['requests', 'unknown-category', 'requests']
    });
    expect(manifest.categories).toEqual(['requests']);
  });

  it('returns an empty array when every category is unknown', () => {
    const manifest = parsePluginManifest({
      ...validManifest,
      categories: ['unknown-category', 'also-unknown']
    });
    expect(manifest.categories).toEqual([]);
  });

  it('leaves categories undefined when omitted', () => {
    const manifest = parsePluginManifest(validManifest);
    expect(manifest.categories).toBeUndefined();
  });

  it('parses an optional summary field', () => {
    const manifest = parsePluginManifest({
      ...validManifest,
      summary: 'Adds a sidebar panel for API audit checks.'
    });
    expect(manifest.summary).toBe('Adds a sidebar panel for API audit checks.');
  });

  it('leaves summary undefined when omitted', () => {
    const manifest = parsePluginManifest(validManifest);
    expect(manifest.summary).toBeUndefined();
  });

  it('rejects an empty summary string', () => {
    expect(() =>
      parsePluginManifest({
        ...validManifest,
        summary: ''
      })
    ).toThrow();
  });

  it('preserves modals contributions', () => {
    const manifest = parsePluginManifest({
      ...validManifest,
      contributes: {
        modals: [{ id: 'schema-editor', title: 'Add JSON Schema' }]
      }
    });
    expect(manifest.contributes?.modals).toEqual([
      { id: 'schema-editor', title: 'Add JSON Schema' }
    ]);
  });

  it('parses high-contrast theme contributions', () => {
    const manifest = parsePluginManifest({
      ...validManifest,
      contributes: {
        themes: [{ id: 'hc', title: 'High Contrast', type: 'high-contrast' }]
      }
    });
    expect(manifest.contributes?.themes).toEqual([
      { id: 'hc', title: 'High Contrast', type: 'high-contrast' }
    ]);
  });

  it('parses theme contributions with an import path', () => {
    const manifest = parsePluginManifest({
      ...validManifest,
      contributes: {
        themes: [
          {
            id: 'solarized',
            title: 'Solarized Dark',
            type: 'dark',
            import: 'exported.json'
          }
        ]
      }
    });
    expect(manifest.contributes?.themes).toEqual([
      {
        id: 'solarized',
        title: 'Solarized Dark',
        type: 'dark',
        import: 'exported.json'
      }
    ]);
  });
});
