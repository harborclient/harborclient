/**
 * Canonical marketplace plugin category slugs in display order.
 */
export declare const PLUGIN_CATALOG_CATEGORIES: readonly ["requests", "auth", "environments", "import", "scripting", "logging", "jwt", "response", "themes", "light", "dark", "high-contrast", "collections", "editor", "testing", "export", "graphql", "websocket", "mock", "debugging", "security", "sidebar", "utilities"];
/**
 * One allowed plugin marketplace category slug.
 */
export type PluginCatalogCategory = (typeof PLUGIN_CATALOG_CATEGORIES)[number];
/**
 * Human-readable labels for marketplace category slugs shown in UI.
 */
export declare const PLUGIN_CATALOG_CATEGORY_LABELS: Record<PluginCatalogCategory, string>;
/**
 * Returns whether a string is a recognized plugin marketplace category slug.
 *
 * @param value - Raw category string from catalog JSON.
 * @returns True when the value is a predefined category slug.
 */
export declare function isPluginCatalogCategory(value: string): value is PluginCatalogCategory;
/**
 * Keeps only predefined category slugs, preserving order and removing duplicates.
 *
 * Unknown categories from catalog entries are dropped so third-party catalogs
 * cannot introduce uncontrolled filter labels in the marketplace UI.
 *
 * @param categories - Raw category strings from a catalog entry.
 * @returns Sanitized category slugs, which may be empty when none are recognized.
 */
export declare function sanitizePluginCatalogCategories(categories: string[]): PluginCatalogCategory[];
//# sourceMappingURL=catalogCategories.d.ts.map