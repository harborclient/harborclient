import { z } from 'zod';
import { sanitizePluginCatalogCategories } from '../plugin/catalogCategories';
/**
 * Public URL of the generated snippet catalog served from harborclient.com.
 */
export const SNIPPET_CATALOG_URL = 'https://harborclient.com/snippet_catalog.json';
/**
 * Zod schema for script execution stages used in catalog validation.
 */
const scriptStage = z.enum([
    'before-all',
    'before-each',
    'main',
    'after-each',
    'after-all'
]);
const snippetManifestId = z
    .string()
    .min(3)
    .regex(/^[a-zA-Z][a-zA-Z0-9.-]*\.[a-zA-Z][a-zA-Z0-9.-]+$/);
const snippetScopeSchema = z.enum([
    'pre-request',
    'post-request',
    'any'
]);
/**
 * Validates that a catalog entry points at a public GitHub repository over HTTPS.
 *
 * @param url - Repository URL from the catalog source file.
 * @returns Trimmed URL when valid.
 */
function parseGitHubRepoUrl(url) {
    const trimmed = url.trim();
    let parsed;
    try {
        parsed = new URL(trimmed);
    }
    catch {
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
 * Parses and validates a snippet catalog payload.
 *
 * @param raw - Unknown JSON value from disk or an HTTP response.
 * @returns Validated catalog with unique snippet bundle ids.
 * @throws When the payload is invalid or contains duplicate ids.
 */
export function parseSnippetCatalog(raw) {
    const parsed = snippetCatalogSchema.parse(raw);
    const seen = new Set();
    for (const entry of parsed.snippets) {
        if (seen.has(entry.id)) {
            throw new Error(`Snippet catalog contains duplicate id: ${entry.id}`);
        }
        seen.add(entry.id);
    }
    return parsed;
}
//# sourceMappingURL=catalog.js.map