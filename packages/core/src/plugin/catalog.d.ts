import { z } from 'zod';
/**
 * Public URL of the generated plugin catalog served from harborclient.com.
 */
export declare const PLUGIN_CATALOG_URL = "https://harborclient.com/plugin_catalog.json";
/**
 * Public URL of the generated theme catalog served from harborclient.com.
 */
export declare const THEME_CATALOG_URL = "https://harborclient.com/theme_catalog.json";
/**
 * Public URL of the official HarborClient plugin signing key served from harborclient.com.
 */
export declare const PLUGIN_SIGNING_PUBLIC_KEY_URL = "https://harborclient.com/plugins/harborclient.key";
/**
 * Public URL of the trusted plugin signing key registry served from harborclient.com.
 */
export declare const PLUGIN_TRUSTED_KEYS_URL = "https://harborclient.com/plugins/trusted.json";
declare const catalogThemeContributionSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    type: z.ZodEnum<{
        light: "light";
        dark: "dark";
        "high-contrast": "high-contrast";
    }>;
}, z.core.$strip>;
/**
 * One theme contribution copied from manifest.contributes.themes into the marketplace catalog.
 */
export type CatalogThemeContribution = z.infer<typeof catalogThemeContributionSchema>;
/**
 * Zod schema for one curated plugin or theme marketplace listing.
 */
export declare const pluginCatalogEntrySchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    version: z.ZodString;
    summary: z.ZodString;
    author: z.ZodString;
    categories: z.ZodPipe<z.ZodArray<z.ZodString>, z.ZodTransform<("light" | "dark" | "high-contrast" | "sidebar" | "auth" | "requests" | "import" | "themes" | "environments" | "scripting" | "logging" | "jwt" | "response" | "collections" | "editor" | "testing" | "export" | "graphql" | "websocket" | "mock" | "debugging" | "security" | "utilities")[], string[]>>;
    repoUrl: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    ref: z.ZodOptional<z.ZodString>;
    homepage: z.ZodOptional<z.ZodString>;
    icon: z.ZodOptional<z.ZodString>;
    screenshot: z.ZodOptional<z.ZodString>;
    screenshots: z.ZodOptional<z.ZodArray<z.ZodString>>;
    description: z.ZodOptional<z.ZodString>;
    minAppVersion: z.ZodOptional<z.ZodString>;
    contributes: z.ZodOptional<z.ZodObject<{
        themes: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            title: z.ZodString;
            type: z.ZodEnum<{
                light: "light";
                dark: "dark";
                "high-contrast": "high-contrast";
            }>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
/**
 * Zod schema for the plugin marketplace catalog document.
 */
export declare const pluginCatalogSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    plugins: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        version: z.ZodString;
        summary: z.ZodString;
        author: z.ZodString;
        categories: z.ZodPipe<z.ZodArray<z.ZodString>, z.ZodTransform<("light" | "dark" | "high-contrast" | "sidebar" | "auth" | "requests" | "import" | "themes" | "environments" | "scripting" | "logging" | "jwt" | "response" | "collections" | "editor" | "testing" | "export" | "graphql" | "websocket" | "mock" | "debugging" | "security" | "utilities")[], string[]>>;
        repoUrl: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
        ref: z.ZodOptional<z.ZodString>;
        homepage: z.ZodOptional<z.ZodString>;
        icon: z.ZodOptional<z.ZodString>;
        screenshot: z.ZodOptional<z.ZodString>;
        screenshots: z.ZodOptional<z.ZodArray<z.ZodString>>;
        description: z.ZodOptional<z.ZodString>;
        minAppVersion: z.ZodOptional<z.ZodString>;
        contributes: z.ZodOptional<z.ZodObject<{
            themes: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                title: z.ZodString;
                type: z.ZodEnum<{
                    light: "light";
                    dark: "dark";
                    "high-contrast": "high-contrast";
                }>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
/**
 * Zod schema for the theme marketplace catalog document.
 */
export declare const themeCatalogSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    themes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        version: z.ZodString;
        summary: z.ZodString;
        author: z.ZodString;
        categories: z.ZodPipe<z.ZodArray<z.ZodString>, z.ZodTransform<("light" | "dark" | "high-contrast" | "sidebar" | "auth" | "requests" | "import" | "themes" | "environments" | "scripting" | "logging" | "jwt" | "response" | "collections" | "editor" | "testing" | "export" | "graphql" | "websocket" | "mock" | "debugging" | "security" | "utilities")[], string[]>>;
        repoUrl: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
        ref: z.ZodOptional<z.ZodString>;
        homepage: z.ZodOptional<z.ZodString>;
        icon: z.ZodOptional<z.ZodString>;
        screenshot: z.ZodOptional<z.ZodString>;
        screenshots: z.ZodOptional<z.ZodArray<z.ZodString>>;
        description: z.ZodOptional<z.ZodString>;
        minAppVersion: z.ZodOptional<z.ZodString>;
        contributes: z.ZodOptional<z.ZodObject<{
            themes: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                title: z.ZodString;
                type: z.ZodEnum<{
                    light: "light";
                    dark: "dark";
                    "high-contrast": "high-contrast";
                }>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
/**
 * One curated plugin listing in the marketplace catalog.
 */
export type PluginCatalogEntry = z.infer<typeof pluginCatalogEntrySchema>;
/**
 * Parsed plugin marketplace catalog returned by the build script and app fetch.
 */
export type PluginCatalog = {
    schemaVersion: 1;
    plugins: PluginCatalogEntry[];
    updatedAt?: string;
};
/**
 * Parsed theme marketplace catalog returned by the build script and app fetch.
 */
export type ThemeCatalog = {
    schemaVersion: 1;
    themes: PluginCatalogEntry[];
    updatedAt?: string;
};
/**
 * Parses and validates a plugin catalog payload.
 *
 * @param raw - Unknown JSON value from disk or an HTTP response.
 * @returns Validated catalog with unique plugin ids.
 * @throws When the payload is invalid or contains duplicate ids.
 */
export declare function parsePluginCatalog(raw: unknown): PluginCatalog;
/**
 * Parses and validates a theme catalog payload.
 *
 * @param raw - Unknown JSON value from disk or an HTTP response.
 * @returns Validated catalog with unique theme plugin ids.
 * @throws When the payload is invalid or contains duplicate ids.
 */
export declare function parseThemeCatalog(raw: unknown): ThemeCatalog;
declare const pluginTrustedKeyEntrySchema: z.ZodObject<{
    author: z.ZodString;
    key: z.ZodString;
}, z.core.$strip>;
/**
 * One trusted plugin signing key URL entry from trusted.json.
 */
export type PluginTrustedKeyEntry = z.infer<typeof pluginTrustedKeyEntrySchema>;
/**
 * Parsed trusted plugin signing key registry.
 */
export type PluginTrustedKeys = PluginTrustedKeyEntry[];
/**
 * Parses and validates a trusted plugin signing key registry payload.
 *
 * @param raw - Unknown JSON value from disk or an HTTP response.
 * @returns Validated trusted key entries with unique key URLs.
 * @throws When the payload is invalid or contains duplicate key URLs.
 */
export declare function parsePluginTrustedKeys(raw: unknown): PluginTrustedKeys;
declare const pluginSourceSchema: z.ZodObject<{
    url: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    enabled: z.ZodBoolean;
}, z.core.$strip>;
/**
 * Zod schema for persisted plugin catalog and trusted-key source settings.
 */
export declare const pluginSourcesSchema: z.ZodObject<{
    catalogs: z.ZodArray<z.ZodObject<{
        url: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
        enabled: z.ZodBoolean;
    }, z.core.$strip>>;
    trusted: z.ZodArray<z.ZodObject<{
        url: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
        enabled: z.ZodBoolean;
    }, z.core.$strip>>;
}, z.core.$strip>;
/**
 * One configurable remote endpoint for plugin catalogs or trusted publisher keys.
 */
export type PluginSource = z.infer<typeof pluginSourceSchema>;
/**
 * User-configured plugin catalog and trusted-key registry endpoints.
 */
export type PluginSourcesSettings = z.infer<typeof pluginSourcesSchema>;
/**
 * Returns the built-in HarborClient catalog and trusted-key endpoints, enabled by default.
 *
 * @returns Default plugin source settings with HarborClient URLs first in each list.
 */
export declare function getDefaultPluginSources(): PluginSourcesSettings;
/**
 * Normalizes persisted plugin source settings with trimmed URLs and deduplication.
 *
 * @param raw - Unknown settings from storage or user input.
 * @returns Validated settings, or defaults when both lists are empty after normalization.
 */
export declare function normalizePluginSources(raw: unknown): PluginSourcesSettings;
/**
 * Returns whether a plugin source URL is hosted on harborclient.com or a subdomain.
 *
 * @param url - Catalog or trusted registry URL to inspect.
 * @returns True when the hostname is harborclient.com or ends with .harborclient.com.
 */
export declare function isHarborClientEndpoint(url: string): boolean;
export {};
//# sourceMappingURL=catalog.d.ts.map