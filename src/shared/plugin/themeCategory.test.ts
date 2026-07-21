import { describe, expect, it } from 'vitest';
import type { PluginCatalogEntry } from './catalog';
import type { PluginCatalogCategory } from './catalogCategories';
import type { PluginInfo } from './types';
import {
  catalogEntryIsTheme,
  filterThemeCatalogByAppearance,
  formatThemeDisplayName,
  getCatalogEntryThemeTypes,
  isThemeAppearanceCategory,
  pluginIsTheme,
  THEME_APPEARANCE_CATEGORIES
} from './themeCategory';

/**
 * Builds a minimal catalog entry for theme classification tests.
 */
function catalogEntry(
  categories: PluginCatalogCategory[],
  contributes?: PluginCatalogEntry['contributes']
): PluginCatalogEntry {
  return {
    id: 'com.example.test',
    name: 'Test',
    version: '1.0.0',
    summary: 'Summary',
    author: 'Author',
    categories,
    repoUrl: 'https://github.com/example/test',
    ...(contributes ? { contributes } : {})
  };
}

/**
 * Builds a minimal installed plugin row for theme classification tests.
 */
function pluginInfo(categories?: PluginCatalogCategory[]): PluginInfo {
  return {
    id: 'com.example.test',
    name: 'Test',
    version: '1.0.0',
    enabled: false,
    path: '/tmp/test',
    source: 'git',
    permissions: [],
    manifest: {
      id: 'com.example.test',
      name: 'Test',
      version: '1.0.0',
      categories,
      engines: { harborclient: '>=1.0.0' },
      permissions: []
    }
  };
}

describe('formatThemeDisplayName', () => {
  it('removes a trailing " Theme" suffix from marketplace theme names', () => {
    expect(formatThemeDisplayName('Nord Theme')).toBe('Nord');
    expect(formatThemeDisplayName('Tokyo Night Storm Theme')).toBe('Tokyo Night Storm');
  });

  it('returns the original name when no theme suffix is present', () => {
    expect(formatThemeDisplayName('Nord')).toBe('Nord');
    expect(formatThemeDisplayName('One Dark')).toBe('One Dark');
  });
});

describe('catalogEntryIsTheme', () => {
  it('returns true when the themes category is present', () => {
    expect(catalogEntryIsTheme(catalogEntry(['themes']))).toBe(true);
    expect(catalogEntryIsTheme(catalogEntry(['editor', 'themes']))).toBe(true);
  });

  it('returns false when the themes category is absent', () => {
    expect(catalogEntryIsTheme(catalogEntry(['editor']))).toBe(false);
    expect(catalogEntryIsTheme(catalogEntry([]))).toBe(false);
  });
});

describe('pluginIsTheme', () => {
  it('returns true when manifest categories include themes', () => {
    expect(pluginIsTheme(pluginInfo(['themes']))).toBe(true);
  });

  it('returns false when manifest categories omit themes', () => {
    expect(pluginIsTheme(pluginInfo(['editor']))).toBe(false);
    expect(pluginIsTheme(pluginInfo())).toBe(false);
  });
});

describe('isThemeAppearanceCategory', () => {
  it('returns true for each theme appearance slug', () => {
    for (const category of THEME_APPEARANCE_CATEGORIES) {
      expect(isThemeAppearanceCategory(category)).toBe(true);
    }
  });

  it('returns false for unrelated category slugs', () => {
    expect(isThemeAppearanceCategory('themes')).toBe(false);
    expect(isThemeAppearanceCategory('editor')).toBe(false);
    expect(isThemeAppearanceCategory('unknown')).toBe(false);
  });
});

describe('getCatalogEntryThemeTypes', () => {
  it('returns contributed theme types from catalog entries', () => {
    expect(
      getCatalogEntryThemeTypes(
        catalogEntry(['themes'], {
          themes: [
            { id: 'dark', title: 'Dark', type: 'dark' },
            { id: 'light', title: 'Light', type: 'light' }
          ]
        })
      )
    ).toEqual(['dark', 'light']);
  });

  it('returns an empty list when theme contributions are absent', () => {
    expect(getCatalogEntryThemeTypes(catalogEntry(['themes']))).toEqual([]);
  });
});

describe('filterThemeCatalogByAppearance', () => {
  const themes: PluginCatalogEntry[] = [
    {
      id: 'com.example.nord',
      name: 'Nord',
      version: '1.0.0',
      summary: 'Summary',
      author: 'Author',
      categories: ['themes'],
      repoUrl: 'https://github.com/example/nord',
      contributes: {
        themes: [{ id: 'nord', title: 'Nord', type: 'dark' }]
      }
    },
    {
      id: 'com.example.solar',
      name: 'Solar',
      version: '1.0.0',
      summary: 'Summary',
      author: 'Author',
      categories: ['themes'],
      repoUrl: 'https://github.com/example/solar',
      contributes: {
        themes: [{ id: 'solar', title: 'Solar', type: 'light' }]
      }
    }
  ];

  it('returns all themes when no appearance is selected', () => {
    expect(filterThemeCatalogByAppearance(themes, '')).toEqual(themes);
  });

  it('filters themes by contributed theme type', () => {
    expect(filterThemeCatalogByAppearance(themes, 'dark').map((entry) => entry.id)).toEqual([
      'com.example.nord'
    ]);
    expect(filterThemeCatalogByAppearance(themes, 'light').map((entry) => entry.id)).toEqual([
      'com.example.solar'
    ]);
  });
});
