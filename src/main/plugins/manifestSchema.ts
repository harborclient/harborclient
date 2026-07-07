import { z } from 'zod';
import { compareVersions, normalizeVersion } from '#/main/settings/versionCompare';
import { sanitizePluginCatalogCategories } from '#/shared/plugin/catalogCategories';
import type { PluginManifest, PluginPermission } from '#/shared/plugin/types';

const contributionEntry = z.object({
  id: z.string().min(1),
  title: z.string().min(1)
});

const themeContributionEntry = contributionEntry.extend({
  type: z.enum(['light', 'dark', 'high-contrast'])
});

const pluginPermission = z.enum([
  'ui',
  'storage',
  'database',
  'filesystem:pick',
  'filesystem:read',
  'filesystem:write',
  'http',
  'network',
  'ipc',
  'server'
]) satisfies z.ZodType<PluginPermission>;

const screenshotEntry = z.union([
  z.string().min(1),
  z.object({
    path: z.string().min(1),
    caption: z.string().optional()
  })
]);

/**
 * Zod schema for plugin manifest.json.
 */
export const pluginManifestSchema = z.object({
  id: z
    .string()
    .min(3)
    .regex(/^[a-zA-Z][a-zA-Z0-9.-]*\.[a-zA-Z][a-zA-Z0-9.-]+$/),
  name: z.string().min(1),
  version: z.string().min(1),
  author: z.string().optional(),
  description: z.string().optional(),
  summary: z.string().min(1).optional(),
  categories: z.array(z.string().min(1)).transform(sanitizePluginCatalogCategories).optional(),
  icon: z.string().optional(),
  screenshots: z.array(screenshotEntry).optional(),
  homepage: z.string().url().optional(),
  bugs: z.object({ url: z.string().url() }).optional(),
  engines: z.object({
    harborclient: z.string().min(1)
  }),
  renderer: z.string().optional(),
  main: z.string().optional(),
  permissions: z.array(pluginPermission).min(1),
  contributes: z
    .object({
      settingsSections: z.array(contributionEntry).optional(),
      sidebarPanels: z.array(contributionEntry).optional(),
      sidebarSections: z.array(contributionEntry).optional(),
      mainViews: z.array(contributionEntry).optional(),
      modals: z.array(contributionEntry).optional(),
      requestTabs: z.array(contributionEntry).optional(),
      responseTabs: z.array(contributionEntry).optional(),
      collectionSettingsTabs: z.array(contributionEntry).optional(),
      footerPanels: z.array(contributionEntry).optional(),
      requestToolbarActions: z.array(contributionEntry).optional(),
      contextMenus: z.array(contributionEntry).optional(),
      statusBarItems: z.array(contributionEntry).optional(),
      themes: z.array(themeContributionEntry).optional(),
      commands: z.array(contributionEntry).optional(),
      menus: z
        .array(
          z.object({
            menu: z.enum(['file', 'edit', 'view', 'help']),
            command: z.string().min(1),
            group: z.string().optional()
          })
        )
        .optional()
    })
    .optional()
}) satisfies z.ZodType<PluginManifest>;

/**
 * Parses and validates raw manifest JSON.
 *
 * @param raw - Parsed JSON object from manifest.json.
 * @returns Validated plugin manifest.
 * @throws When validation fails.
 */
export function parsePluginManifest(raw: unknown): PluginManifest {
  return pluginManifestSchema.parse(raw);
}

/**
 * Parses a semver range like `>=1.7.0` against the running app version.
 *
 * @param range - engines.harborclient value from the manifest.
 * @param appVersion - HarborClient semver from package metadata.
 * @returns True when the app satisfies the requirement.
 */
export function satisfiesHarborClientEngine(range: string, appVersion: string): boolean {
  const trimmed = range.trim();
  const match = /^(>=|<=|>|<|=)?\s*(.+)$/.exec(trimmed);
  if (!match) {
    return false;
  }

  const operator = match[1] ?? '>=';
  const required = normalizeVersion(match[2]);
  const current = normalizeVersion(appVersion);
  const comparison = compareVersions(current, required);

  switch (operator) {
    case '>=':
      return comparison >= 0;
    case '<=':
      return comparison <= 0;
    case '>':
      return comparison > 0;
    case '<':
      return comparison < 0;
    case '=':
      return comparison === 0;
    default:
      return false;
  }
}

/**
 * Validates manifest content and engine compatibility.
 *
 * @param raw - Parsed JSON object from manifest.json.
 * @param appVersion - HarborClient semver from package metadata.
 * @returns Validated plugin manifest.
 * @throws When validation or engine check fails.
 */
export function validatePluginManifest(raw: unknown, appVersion: string): PluginManifest {
  const manifest = parsePluginManifest(raw);
  if (!manifest.renderer && !manifest.main) {
    throw new Error('Plugin manifest must declare at least one of "renderer" or "main".');
  }
  if (!satisfiesHarborClientEngine(manifest.engines.harborclient, appVersion)) {
    throw new Error(
      `Plugin requires HarborClient ${manifest.engines.harborclient}; running ${appVersion}.`
    );
  }
  return manifest;
}
