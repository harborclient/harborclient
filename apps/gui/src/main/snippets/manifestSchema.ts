import { z } from 'zod';
import { compareVersions, normalizeVersion } from '#/main/settings/versionCompare';
import { scriptStage } from '#/main/schemas/scriptRef';
import { sanitizePluginCatalogCategories } from '#/shared/plugin/catalogCategories';
import type { ScriptStage } from '@harborclient/sdk';
import type { SnippetScope } from '#/shared/snippetScope';

const snippetScopeSchema = z.enum([
  'pre-request',
  'post-request',
  'any'
]) satisfies z.ZodType<SnippetScope>;

const screenshotEntry = z.union([
  z.string().min(1),
  z.object({
    path: z.string().min(1),
    caption: z.string().optional()
  })
]);

const snippetManifestEntrySchema = z.object({
  name: z.string().min(1),
  phase: snippetScopeSchema,
  stage: scriptStage,
  file: z.string().min(1),
  uuid: z.string().min(1).optional()
});

/**
 * Parsed snippets.json bundle manifest from a snippet repository.
 */
export interface SnippetManifest {
  id: string;
  name: string;
  version: string;
  author?: string;
  summary?: string;
  description?: string;
  categories?: string[];
  screenshots?: Array<string | { path: string; caption?: string }>;
  homepage?: string;
  engines: { harborclient: string };
  snippets: Array<{
    name: string;
    phase: SnippetScope;
    stage: ScriptStage;
    file: string;
    uuid?: string;
  }>;
}

/**
 * Zod schema for snippets.json in a snippet marketplace repository.
 */
export const snippetManifestSchema = z.object({
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
  screenshots: z.array(screenshotEntry).optional(),
  homepage: z.string().url().optional(),
  engines: z.object({
    harborclient: z.string().min(1)
  }),
  snippets: z.array(snippetManifestEntrySchema).min(1)
}) satisfies z.ZodType<SnippetManifest>;

/**
 * Parses and validates raw snippets.json.
 *
 * @param raw - Parsed JSON object from snippets.json.
 * @returns Validated snippet bundle manifest.
 * @throws When validation fails.
 */
export function parseSnippetManifest(raw: unknown): SnippetManifest {
  return snippetManifestSchema.parse(raw);
}

/**
 * Parses a semver range like `>=2.0.0` against the running app version.
 *
 * @param range - Engine requirement from snippets.json.
 * @param appVersion - Running HarborClient version string.
 * @returns True when the app version satisfies the range.
 */
export function satisfiesHarborClientSnippetEngine(range: string, appVersion: string): boolean {
  const trimmed = range.trim();
  const match = /^>=\s*(.+)$/.exec(trimmed);
  if (!match) {
    return false;
  }
  const minimum = normalizeVersion(match[1]);
  const current = normalizeVersion(appVersion);
  return compareVersions(current, minimum) >= 0;
}

/**
 * Parses and validates snippets.json and checks engine compatibility.
 *
 * @param raw - Parsed JSON object from snippets.json.
 * @param appVersion - Running HarborClient version string.
 * @returns Validated snippet bundle manifest.
 * @throws When validation or engine checks fail.
 */
export function validateSnippetManifest(raw: unknown, appVersion: string): SnippetManifest {
  const manifest = parseSnippetManifest(raw);
  if (!satisfiesHarborClientSnippetEngine(manifest.engines.harborclient, appVersion)) {
    throw new Error(
      `Snippet bundle requires HarborClient ${manifest.engines.harborclient}, but this app is ${appVersion}.`
    );
  }
  return manifest;
}
