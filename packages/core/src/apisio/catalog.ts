import { z } from 'zod';

/**
 * Production base URL for the apis.io discovery API.
 */
export const APIS_IO_API_BASE = 'https://apis.io/api/v1';

/**
 * Importable collection formats published on apis.io that HarborClient supports.
 */
export type ApisIoCollectionFormat = 'postman' | 'opencollection';

/**
 * Optional nested metadata returned with a collection listing.
 */
const apisIoCollectionMetaSchema = z
  .object({
    item_count: z.number().int().nonnegative().optional()
  })
  .passthrough();

/**
 * One Open Collection or Postman Collection listing from `GET /collections`.
 */
export const apisIoCollectionSchema = z
  .object({
    type: z.string().min(1),
    slug: z.string().min(1),
    name: z.string().min(1),
    provider_slug: z.string().min(1),
    provider_name: z.string().min(1).optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    url: z.string().min(1),
    meta: apisIoCollectionMetaSchema.optional()
  })
  .passthrough();

/**
 * One catalog collection from the apis.io `/collections` endpoint.
 */
export type ApisIoCollection = z.infer<typeof apisIoCollectionSchema>;

/**
 * Pagination and echoed query metadata for apis.io list responses.
 */
export const apisIoListMetaSchema = z
  .object({
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    pages: z.number().int().nonnegative(),
    query: z.record(z.string(), z.unknown()).optional()
  })
  .passthrough();

/**
 * Paginated list of collections from `GET /collections`.
 */
export const apisIoCollectionListSchema = z
  .object({
    meta: apisIoListMetaSchema,
    data: z.array(apisIoCollectionSchema)
  })
  .passthrough();

/**
 * Paginated collection search result from apis.io.
 */
export type ApisIoCollectionList = z.infer<typeof apisIoCollectionListSchema>;

/**
 * Parses and validates a paginated apis.io collections response.
 *
 * @param raw - Unknown JSON payload from the API.
 * @returns Validated list document.
 * @throws When the payload does not match the expected shape.
 */
export function parseApisIoCollectionList(raw: unknown): ApisIoCollectionList {
  return apisIoCollectionListSchema.parse(raw);
}

/**
 * Detects whether a catalog entry is a Postman or Open Collection artifact.
 *
 * Prefers the artifact URL suffix, then falls back to known tags.
 *
 * @param item - Catalog collection listing.
 * @returns Format when recognized, otherwise null.
 */
export function detectApisIoCollectionFormat(
  item: ApisIoCollection
): ApisIoCollectionFormat | null {
  const url = item.url.trim().toLowerCase();
  if (url.includes('.postman_collection.json') || url.endsWith('.postman_collection.json')) {
    return 'postman';
  }
  if (url.includes('.opencollection.json') || url.endsWith('.opencollection.json')) {
    return 'opencollection';
  }

  const tags = (item.tags ?? []).map((tag) => tag.trim().toLowerCase());
  if (tags.includes('postman collection')) {
    return 'postman';
  }
  if (tags.includes('open collection')) {
    return 'opencollection';
  }

  return null;
}

/**
 * Builds the human-facing apis.io collection detail page URL.
 *
 * @param item - Catalog collection listing.
 * @returns Absolute HTTPS URL for the collection page.
 */
export function apisIoCollectionPageUrl(item: ApisIoCollection): string {
  return `https://apis.io/collections/${encodeURIComponent(item.provider_slug)}/${encodeURIComponent(item.slug)}/`;
}

/**
 * Fallback raw GitHub base for api-evangelist provider repositories.
 *
 * @param providerSlug - Provider slug from the catalog.
 * @returns Directory URL ending with `/` suitable for `new URL(relative, base)`.
 */
export function apisIoFallbackRawBase(providerSlug: string): string {
  return `https://raw.githubusercontent.com/api-evangelist/${encodeURIComponent(providerSlug)}/refs/heads/main/`;
}

/**
 * Returns true when a URL is safe to fetch as an apis.io collection artifact.
 *
 * Only HTTPS URLs on `raw.githubusercontent.com` or `apis.io` are allowed so a
 * malicious catalog entry cannot redirect the app to arbitrary hosts.
 *
 * @param url - Absolute URL to validate.
 * @returns Whether the host and protocol are permitted.
 */
export function isAllowedApisIoArtifactHost(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') {
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  return host === 'raw.githubusercontent.com' || host === 'apis.io' || host.endsWith('.apis.io');
}

/**
 * Resolves a catalog artifact URL to an absolute HTTPS URL.
 *
 * Absolute URLs are returned as-is (after validation). Relative paths are resolved
 * against the provider's `apis.yml` raw URL when available, otherwise against the
 * api-evangelist raw GitHub fallback for that provider.
 *
 * @param relativeOrAbsoluteUrl - Catalog `url` field (absolute or repo-relative).
 * @param providerApisYmlUrl - Provider `url` pointing at `apis.yml`, when known.
 * @param providerSlug - Provider slug used for the fallback raw base.
 * @returns Absolute artifact URL, or null when resolution fails or the host is blocked.
 */
export function resolveApisIoArtifactUrl(
  relativeOrAbsoluteUrl: string,
  providerApisYmlUrl: string | null,
  providerSlug: string
): string | null {
  const trimmed = relativeOrAbsoluteUrl.trim();
  if (!trimmed || trimmed.includes('..')) {
    return null;
  }

  let absolute: string;
  try {
    const asAbsolute = new URL(trimmed);
    absolute = asAbsolute.href;
  } catch {
    const base =
      providerApisYmlUrl?.trim() ||
      (providerSlug.trim() ? apisIoFallbackRawBase(providerSlug.trim()) : '');
    if (!base) {
      return null;
    }
    try {
      absolute = new URL(trimmed.replace(/^\/+/, ''), base.endsWith('/') ? base : `${base}`).href;
    } catch {
      return null;
    }
  }

  if (!isAllowedApisIoArtifactHost(absolute)) {
    return null;
  }

  return absolute;
}

/**
 * Human-readable label for an importable apis.io collection format.
 *
 * @param format - Detected format.
 * @returns Label shown in the UI.
 */
export function apisIoCollectionFormatLabel(format: ApisIoCollectionFormat): string {
  return format === 'postman' ? 'Postman Collection' : 'Open Collection';
}
