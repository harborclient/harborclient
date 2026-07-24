import { z } from 'zod';
import { scriptStage } from '#/main/schemas/scriptRef';
import { sanitizePluginCatalogCategories } from '#/shared/plugin/catalogCategories';
import type { SnippetScope } from '#/shared/snippetScope';

/**
 * Public URL of the generated snippet catalog served from harborclient.com.
 */
export const SNIPPET_CATALOG_URL = 'https://harborclient.com/snippet_catalog.json';

const snippetManifestId = z
  .string()
  .min(3)
  .regex(/^[a-zA-Z][a-zA-Z0-9.-]*\.[a-zA-Z][a-zA-Z0-9.-]+$/);

const snippetScopeSchema = z.enum([
  'pre-request',
  'post-request',
  'any'
]) satisfies z.ZodType<SnippetScope>;

/**
 * Validates that a catalog entry points at a public GitHub repository over HTTPS.
 *
 * @param url - Repository URL from the catalog source file.
 * @returns Trimmed URL when valid.
 */
function parseGitHubRepoUrl(url: string): string {
  const trimmed = url.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Snippet catalog repoUrl is not valid: ${url}`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(`Snippet catalog repoUrl must use https://: ${url}`);
  }

  if (parsed.hostname !== 'github.com') {
    throw new Error(`Snippet catalog repoUrl must be hosted on github.com: ${url}`);
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length < 2) {
    throw new Error(`Snippet catalog repoUrl must include owner and repository: ${url}`);
  }

  return trimmed;
}

const snippetCatalogSnippetEntrySchema = z.object({
  name: z.string().min(1),
  phase: snippetScopeSchema,
  stage: scriptStage,
  file: z.string().min(1),
  uuid: z.string().min(1).optional()
});

/**
 * One snippet entry declared in a marketplace bundle manifest.
 */
export type SnippetCatalogSnippetEntry = z.infer<typeof snippetCatalogSnippetEntrySchema>;

const snippetCatalogEntrySchema = z.object({
  id: snippetManifestId,
  name: z.string().min(1),
  version: z.string().min(1),
  summary: z.string().min(1),
  author: z.string().min(1),
  categories: z.array(z.string().min(1)).transform(sanitizePluginCatalogCategories),
  repoUrl: z.string().min(1).transform(parseGitHubRepoUrl),
  ref: z.string().min(1).optional(),
  homepage: z.string().url().optional(),
  icon: z.string().url().optional(),
  /** Absolute URL or repository-relative path (e.g. `screenshot.png`). */
  screenshot: z.string().min(1).optional(),
  /** Absolute URLs or repository-relative paths for marketplace thumbnails. */
  screenshots: z.array(z.string().min(1)).optional(),
  /** Inlined Markdown description fetched from the snippet repository at build time. */
  description: z.string().min(1).optional(),
  minAppVersion: z.string().min(1).optional(),
  snippets: z.array(snippetCatalogSnippetEntrySchema).min(1)
});

/**
 * Zod schema for the snippet marketplace catalog document.
 */
export const snippetCatalogSchema = z.object({
  schemaVersion: z.literal(1),
  snippets: z.array(snippetCatalogEntrySchema)
});

/**
 * One curated snippet bundle listing in the marketplace catalog.
 */
export type SnippetCatalogEntry = z.infer<typeof snippetCatalogEntrySchema>;

/**
 * Parsed snippet marketplace catalog returned by the build script and app fetch.
 */
export type SnippetCatalog = {
  schemaVersion: 1;
  snippets: SnippetCatalogEntry[];
  updatedAt?: string;
};

/**
 * Parses and validates a snippet catalog payload.
 *
 * @param raw - Unknown JSON value from disk or an HTTP response.
 * @returns Validated catalog with unique snippet bundle ids.
 * @throws When the payload is invalid or contains duplicate ids.
 */
export function parseSnippetCatalog(raw: unknown): SnippetCatalog {
  const parsed = snippetCatalogSchema.parse(raw);
  const seen = new Set<string>();

  for (const entry of parsed.snippets) {
    if (seen.has(entry.id)) {
      throw new Error(`Snippet catalog contains duplicate id: ${entry.id}`);
    }
    seen.add(entry.id);
  }

  return parsed;
}
