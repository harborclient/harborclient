import {
  APIS_IO_API_BASE,
  detectApisIoCollectionFormat,
  parseApisIoCollectionList,
  resolveApisIoArtifactUrl,
  type ApisIoCollection,
  type ApisIoCollectionFormat,
  type ApisIoCollectionList
} from '@harborclient/core/apisio/catalog';
import {
  canImportOpenCollection,
  isOpenCollection,
  parseOpenCollectionDocument
} from '#/main/import/opencollection';
import { isPostmanCollection } from '#/main/import/postman';

/**
 * Default page size for apis.io collection search.
 */
const SEARCH_PAGE_SIZE = 25;

/**
 * Network timeout for apis.io catalog and artifact fetches.
 */
const FETCH_TIMEOUT_MS = 15_000;

/**
 * Maximum number of parsed documents kept in memory for preview → import reuse.
 */
const DOCUMENT_CACHE_LIMIT = 16;

/**
 * Cached parsed artifact document keyed by absolute source URL.
 */
interface CachedDocument {
  /**
   * Absolute URL the document was fetched from.
   */
  sourceUrl: string;

  /**
   * Detected import format.
   */
  format: ApisIoCollectionFormat;

  /**
   * Parsed JSON/YAML document ready for `importCollectionFromParsed`.
   */
  parsed: unknown;
}

/**
 * Summary of folders and requests for the public-collection detail modal.
 */
export interface ApisIoDocumentSummary {
  /**
   * Total number of HTTP requests in the document.
   */
  requestCount: number;

  /**
   * Total number of folders in the document.
   */
  folderCount: number;

  /**
   * Top-level folder and request names (shallow outline).
   */
  outline: string[];
}

/**
 * Preview payload returned to the renderer for a public collection.
 */
export interface ApisIoCollectionPreview {
  /**
   * Original catalog listing.
   */
  item: ApisIoCollection;

  /**
   * Detected import format.
   */
  format: ApisIoCollectionFormat;

  /**
   * Absolute URL the artifact was fetched from.
   */
  sourceUrl: string;

  /**
   * Total number of HTTP requests in the document.
   */
  requestCount: number;

  /**
   * Total number of folders in the document.
   */
  folderCount: number;

  /**
   * Top-level folder and request names.
   */
  outline: string[];
}

/**
 * Memoized provider `apis.yml` raw URLs keyed by provider slug.
 */
const providerRawBaseCache = new Map<string, string | null>();

/**
 * Bounded cache of fetched collection documents keyed by absolute URL.
 */
const documentCache = new Map<string, CachedDocument>();

/**
 * Clears in-memory provider and document caches (used by tests).
 */
export function clearApisIoCaches(): void {
  providerRawBaseCache.clear();
  documentCache.clear();
}

/**
 * Performs a timed HTTPS GET and returns the response text.
 *
 * @param url - Absolute URL to fetch.
 * @param accept - Optional Accept header value.
 * @returns Response body as text.
 * @throws When the response is not OK or the request fails.
 */
async function fetchText(url: string, accept?: string): Promise<string> {
  const response = await fetch(url, {
    headers: accept ? { Accept: accept } : undefined,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}): ${url}`);
  }

  return response.text();
}

/**
 * Performs a timed HTTPS GET and returns parsed JSON.
 *
 * @param url - Absolute URL to fetch.
 * @returns Parsed JSON value.
 * @throws When the response is not OK or the body is not JSON.
 */
async function fetchJson(url: string): Promise<unknown> {
  const text = await fetchText(url, 'application/json');
  return JSON.parse(text) as unknown;
}

/**
 * Searches the apis.io catalog for Open Collection and Postman Collection artifacts.
 *
 * @param query - Free-text query over name and description.
 * @param page - 1-based page number (defaults to 1).
 * @returns Paginated collection list.
 * @throws When the query is empty or the API request fails.
 */
export async function searchApisIoCollections(
  query: string,
  page = 1
): Promise<ApisIoCollectionList> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error('Enter a search query.');
  }

  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const url = new URL(`${APIS_IO_API_BASE}/collections`);
  url.searchParams.set('q', trimmed);
  url.searchParams.set('page', String(safePage));
  url.searchParams.set('limit', String(SEARCH_PAGE_SIZE));

  let raw: unknown;
  try {
    raw = await fetchJson(url.href);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to search apis.io collections: ${message}`);
  }

  try {
    return parseApisIoCollectionList(raw);
  } catch {
    throw new Error('apis.io returned an unexpected collections response.');
  }
}

/**
 * Resolves the provider's raw GitHub base URL from `GET /providers/{slug}`.
 *
 * Results are memoized. Failures return null so callers can use the fallback base.
 *
 * @param providerSlug - Provider slug from the catalog listing.
 * @returns Provider `apis.yml` raw URL, or null when unavailable.
 */
export async function resolveProviderRawBase(providerSlug: string): Promise<string | null> {
  const slug = providerSlug.trim();
  if (!slug) {
    return null;
  }

  if (providerRawBaseCache.has(slug)) {
    return providerRawBaseCache.get(slug) ?? null;
  }

  try {
    const raw = await fetchJson(`${APIS_IO_API_BASE}/providers/${encodeURIComponent(slug)}`);
    const url =
      raw && typeof raw === 'object' && typeof (raw as { url?: unknown }).url === 'string'
        ? (raw as { url: string }).url.trim()
        : '';
    const value = url || null;
    providerRawBaseCache.set(slug, value);
    return value;
  } catch {
    providerRawBaseCache.set(slug, null);
    return null;
  }
}

/**
 * Stores a document in the bounded cache, evicting the oldest entry when full.
 *
 * @param entry - Cached document to store.
 */
function cacheDocument(entry: CachedDocument): void {
  if (documentCache.has(entry.sourceUrl)) {
    documentCache.delete(entry.sourceUrl);
  }
  documentCache.set(entry.sourceUrl, entry);
  while (documentCache.size > DOCUMENT_CACHE_LIMIT) {
    const oldest = documentCache.keys().next().value;
    if (oldest == null) {
      break;
    }
    documentCache.delete(oldest);
  }
}

/**
 * Parses raw artifact text into a document object for import.
 *
 * @param text - Raw file contents.
 * @param format - Expected format from the catalog listing.
 * @returns Parsed document.
 * @throws When the text cannot be parsed or does not match a supported format.
 */
function parseArtifactText(text: string, format: ApisIoCollectionFormat): unknown {
  if (format === 'opencollection' || canImportOpenCollection(text)) {
    const parsed = parseOpenCollectionDocument(text);
    if (!isOpenCollection(parsed) && format === 'opencollection') {
      throw new Error('Downloaded Open Collection document is invalid.');
    }
    if (isOpenCollection(parsed)) {
      return parsed;
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error('Downloaded collection document is not valid JSON.');
  }

  if (format === 'postman' && !isPostmanCollection(parsed)) {
    throw new Error('Downloaded Postman collection document is invalid.');
  }

  return parsed;
}

/**
 * Fetches and parses a catalog collection artifact, using the document cache when possible.
 *
 * @param item - Catalog collection listing.
 * @returns Cached document with absolute source URL and format.
 * @throws When the format is unsupported, the URL is blocked, or the download fails.
 */
export async function fetchApisIoCollectionDocument(
  item: ApisIoCollection
): Promise<CachedDocument> {
  const format = detectApisIoCollectionFormat(item);
  if (!format) {
    throw new Error(
      'This apis.io listing is not an importable Open Collection or Postman Collection.'
    );
  }

  const providerApisYmlUrl = await resolveProviderRawBase(item.provider_slug);
  const sourceUrl = resolveApisIoArtifactUrl(item.url, providerApisYmlUrl, item.provider_slug);
  if (!sourceUrl) {
    throw new Error('Could not resolve a safe download URL for this collection.');
  }

  const cached = documentCache.get(sourceUrl);
  if (cached) {
    return cached;
  }

  let text: string;
  try {
    text = await fetchText(sourceUrl, 'application/json, text/yaml, text/plain, */*');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to download collection: ${message}`);
  }

  const parsed = parseArtifactText(text, format);
  const entry: CachedDocument = { sourceUrl, format, parsed };
  cacheDocument(entry);
  return entry;
}

/**
 * Counts requests and folders in a Postman collection document.
 *
 * @param items - Top-level or nested Postman `item` array.
 * @returns Aggregate counts.
 */
function countPostmanItems(items: unknown[]): { requestCount: number; folderCount: number } {
  let requestCount = 0;
  let folderCount = 0;

  for (const item of items) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const record = item as { item?: unknown; request?: unknown };
    if (Array.isArray(record.item)) {
      folderCount += 1;
      const nested = countPostmanItems(record.item);
      requestCount += nested.requestCount;
      folderCount += nested.folderCount;
    } else if (record.request) {
      requestCount += 1;
    }
  }

  return { requestCount, folderCount };
}

/**
 * Counts requests and folders in an Open Collection document.
 *
 * @param items - Top-level or nested Open Collection `items` array.
 * @returns Aggregate counts.
 */
function countOpenCollectionItems(items: unknown[]): { requestCount: number; folderCount: number } {
  let requestCount = 0;
  let folderCount = 0;

  for (const item of items) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const record = item as {
      info?: { type?: string; name?: string };
      items?: unknown[];
      http?: unknown;
    };
    const type = typeof record.info?.type === 'string' ? record.info.type.trim() : '';
    if (type === 'folder' || Array.isArray(record.items)) {
      folderCount += 1;
      if (Array.isArray(record.items)) {
        const nested = countOpenCollectionItems(record.items);
        requestCount += nested.requestCount;
        folderCount += nested.folderCount;
      }
    } else if (type === 'http' || record.http) {
      requestCount += 1;
    }
  }

  return { requestCount, folderCount };
}

/**
 * Reads a display name from a Postman or Open Collection item.
 *
 * @param item - Loose item node.
 * @returns Trimmed name, or null when absent.
 */
function readItemName(item: unknown): string | null {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const record = item as { name?: unknown; info?: { name?: unknown } };
  if (typeof record.name === 'string' && record.name.trim()) {
    return record.name.trim();
  }
  if (typeof record.info?.name === 'string' && record.info.name.trim()) {
    return record.info.name.trim();
  }
  return null;
}

/**
 * Builds a shallow outline of top-level folder and request names.
 *
 * @param parsed - Parsed Postman or Open Collection document.
 * @param format - Detected format.
 * @returns Summary with counts and top-level names.
 */
export function summarizeApisIoDocument(
  parsed: unknown,
  format: ApisIoCollectionFormat
): ApisIoDocumentSummary {
  if (!parsed || typeof parsed !== 'object') {
    return { requestCount: 0, folderCount: 0, outline: [] };
  }

  const record = parsed as { item?: unknown; items?: unknown[] };
  const topLevel =
    format === 'postman'
      ? Array.isArray(record.item)
        ? record.item
        : []
      : Array.isArray(record.items)
        ? record.items
        : [];

  const counts =
    format === 'postman' ? countPostmanItems(topLevel) : countOpenCollectionItems(topLevel);
  const outline = topLevel
    .map((item) => readItemName(item))
    .filter((name): name is string => name != null);

  return {
    requestCount: counts.requestCount,
    folderCount: counts.folderCount,
    outline
  };
}

/**
 * Fetches a catalog collection and returns a preview summary for the detail modal.
 *
 * @param item - Catalog collection listing.
 * @returns Preview payload including outline and counts.
 */
export async function previewApisIoCollection(
  item: ApisIoCollection
): Promise<ApisIoCollectionPreview> {
  const document = await fetchApisIoCollectionDocument(item);
  const summary = summarizeApisIoDocument(document.parsed, document.format);
  return {
    item,
    format: document.format,
    sourceUrl: document.sourceUrl,
    requestCount: summary.requestCount,
    folderCount: summary.folderCount,
    outline: summary.outline
  };
}
