import { describe, expect, it } from 'vitest';
import type { PluginCatalogEntry } from '#/shared/plugin/catalog';
import type { PluginCatalogCategory } from '#/shared/plugin/catalogCategories';
import type { PluginInfo } from '#/shared/plugin/types';
import {
  catalogEntryIsTheme,
  isThemeAppearanceCategory,
  pluginIsTheme,
  THEME_APPEARANCE_CATEGORIES
} from '#/shared/plugin/themeCategory';

/**
 * Builds a minimal catalog entry for theme classification tests.
 */
function catalogEntry(categories: PluginCatalogCategory[]): PluginCatalogEntry {
  return {
    id: 'com.example.test',
    name: 'Test',
    version: '1.0.0',
    summary: 'Summary',
    author: 'Author',
    categories,
    repoUrl: 'https://github.com/example/test'
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
