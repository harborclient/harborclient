import type { PluginCatalogEntry } from '#/shared/plugin/catalog';
import type { PluginInfo } from '#/shared/plugin/types';

/**
 * Marketplace/manifest category slug that marks a plugin as a theme.
 */
export const THEME_CATEGORY = 'themes' as const;

/**
 * Marketplace category slugs that describe a theme's light, dark, or high-contrast appearance.
 */
export const THEME_APPEARANCE_CATEGORIES = ['light', 'dark', 'high-contrast'] as const;

/**
 * One allowed theme appearance category slug.
 */
export type ThemeAppearanceCategory = (typeof THEME_APPEARANCE_CATEGORIES)[number];

const themeAppearanceCategorySet = new Set<string>(THEME_APPEARANCE_CATEGORIES);

/**
 * Returns whether a string is a recognized theme appearance category slug.
 *
 * @param value - Raw category string from a catalog entry or manifest.
 * @returns True when the value is a predefined theme appearance slug.
 */
export function isThemeAppearanceCategory(value: string): value is ThemeAppearanceCategory {
  return themeAppearanceCategorySet.has(value);
}

/**
 * Returns whether a marketplace catalog entry is a theme plugin.
 *
 * @param entry - Catalog listing to classify.
 * @returns True when the entry includes the themes category slug.
 */
export function catalogEntryIsTheme(entry: PluginCatalogEntry): boolean {
  return entry.categories.includes(THEME_CATEGORY);
}

/**
 * Returns whether an installed plugin is a theme based on its manifest categories.
 *
 * @param plugin - Installed plugin metadata row.
 * @returns True when the manifest lists the themes category slug.
 */
export function pluginIsTheme(plugin: PluginInfo): boolean {
  return plugin.manifest.categories?.includes(THEME_CATEGORY) ?? false;
}
