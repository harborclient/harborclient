/**
 * Maximum favicon response body size accepted for caching and tab-bar display.
 */
export const FAVICON_MAX_BYTES = 256 * 1024;

/**
 * Default in-memory favicon cache lifetime (10 minutes).
 */
export const FAVICON_CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * One scraped or Chromium-discovered favicon candidate before ranking.
 */
export interface FaviconCandidate {
  /**
   * Absolute http(s) URL of the icon resource.
   */
  href: string;

  /**
   * Raw `rel` attribute when scraped from a `<link>` (empty for Chromium lists).
   */
  rel?: string;

  /**
   * Declared pixel size from `sizes` (e.g. 32 for `32x32`), when known.
   */
  size?: number;
}

/**
 * Cached favicon payload keyed by page origin.
 */
interface FaviconCacheEntry {
  /**
   * Data URL suitable for an `<img src>`.
   */
  dataUrl: string;

  /**
   * Epoch ms after which the entry is considered stale.
   */
  expiresAt: number;
}

/**
 * Returns whether a page URL is eligible for favicon resolution (http/https only).
 *
 * @param pageUrl - Guest document URL.
 * @returns True when favicons may be fetched for this page.
 */
export function isFaviconEligibleUrl(pageUrl: string): boolean {
  try {
    const parsed = new URL(pageUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Returns the origin string used as the favicon cache key, or null when ineligible.
 *
 * @param pageUrl - Guest document URL.
 * @returns Origin (e.g. `https://example.com`) or null.
 */
export function faviconCacheKeyForUrl(pageUrl: string): string | null {
  if (!isFaviconEligibleUrl(pageUrl)) {
    return null;
  }
  try {
    return new URL(pageUrl).origin;
  } catch {
    return null;
  }
}

/**
 * Absolute URL for the conventional `/favicon.ico` fallback on a page origin.
 *
 * @param pageUrl - Guest document URL.
 * @returns Absolute favicon.ico URL, or null when the page is not http(s).
 */
export function defaultFaviconIcoUrl(pageUrl: string): string | null {
  const origin = faviconCacheKeyForUrl(pageUrl);
  if (!origin) {
    return null;
  }
  return `${origin}/favicon.ico`;
}

/**
 * Parses a `sizes` attribute into a single numeric preference (smallest declared).
 *
 * @param sizes - HTML `sizes` value such as `16x16 32x32` or `any`.
 * @returns Smallest width when present; undefined for `any` or empty.
 */
export function parseFaviconSizes(sizes: string | undefined): number | undefined {
  if (!sizes || !sizes.trim()) {
    return undefined;
  }
  const trimmed = sizes.trim().toLowerCase();
  if (trimmed === 'any') {
    return undefined;
  }
  let smallest: number | undefined;
  for (const part of trimmed.split(/\s+/)) {
    const match = /^(\d+)x(\d+)$/i.exec(part);
    if (!match) {
      continue;
    }
    const width = Number(match[1]);
    if (!Number.isFinite(width) || width <= 0) {
      continue;
    }
    if (smallest === undefined || width < smallest) {
      smallest = width;
    }
  }
  return smallest;
}

/**
 * Scores a favicon candidate so smaller / `rel=icon` entries rank above apple-touch icons.
 *
 * Lower scores are preferred.
 *
 * @param candidate - Candidate to score.
 * @returns Sort key (lower is better).
 */
export function scoreFaviconCandidate(candidate: FaviconCandidate): number {
  const rel = (candidate.rel ?? '').toLowerCase();
  let relPenalty = 50;
  if (rel.includes('shortcut')) {
    relPenalty = 0;
  } else if (/\bicon\b/.test(rel) && !rel.includes('apple')) {
    relPenalty = 10;
  } else if (rel.includes('apple-touch')) {
    relPenalty = 80;
  } else if (!rel) {
    relPenalty = 20;
  }

  const size = candidate.size;
  const sizePenalty =
    size === undefined ? 40 : size <= 16 ? 0 : size <= 32 ? 5 : size <= 64 ? 15 : 40;

  return relPenalty + sizePenalty;
}

/**
 * Resolves a possibly-relative icon href against the page URL.
 *
 * @param href - Raw href from Chromium or a `<link>`.
 * @param pageUrl - Document URL used as the base.
 * @returns Absolute http(s) URL, or null when invalid/disallowed.
 */
export function absoluteFaviconHref(href: string, pageUrl: string): string | null {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith('data:')) {
    return trimmed.startsWith('data:') ? trimmed : null;
  }
  try {
    const absolute = new URL(trimmed, pageUrl).href;
    if (absolute.startsWith('data:')) {
      return absolute;
    }
    const parsed = new URL(absolute);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * Normalizes and ranks favicon candidate URLs, returning unique absolute hrefs best-first.
 *
 * @param candidates - Raw candidates from Chromium or DOM scrape.
 * @param pageUrl - Document URL for resolving relative hrefs.
 * @returns Deduplicated absolute URLs ordered by preference.
 */
export function rankFaviconCandidates(
  candidates: readonly FaviconCandidate[],
  pageUrl: string
): string[] {
  const scored: Array<{ href: string; score: number }> = [];
  for (const candidate of candidates) {
    const href = absoluteFaviconHref(candidate.href, pageUrl);
    if (!href || href.startsWith('data:')) {
      // Data URLs are handled separately by the caller; skip ranking for http fetch.
      if (href?.startsWith('data:')) {
        scored.push({ href, score: -1 });
      }
      continue;
    }
    scored.push({ href, score: scoreFaviconCandidate(candidate) });
  }
  scored.sort((a, b) => a.score - b.score);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of scored) {
    if (seen.has(entry.href)) {
      continue;
    }
    seen.add(entry.href);
    result.push(entry.href);
  }
  return result;
}

/**
 * Builds candidates from Chromium `page-favicon-updated` URL strings.
 *
 * @param favicons - Absolute or relative URLs from Electron.
 * @param pageUrl - Current page URL for resolution.
 * @returns Ranked absolute candidate URLs (data URLs first when present).
 */
export function candidatesFromChromiumFavicons(
  favicons: readonly string[],
  pageUrl: string
): string[] {
  return rankFaviconCandidates(
    favicons.map((href) => ({ href })),
    pageUrl
  );
}

/**
 * Builds ranked candidates from scraped `<link>` rows.
 *
 * @param links - Rows with href/rel/sizes from the guest document.
 * @param pageUrl - Document URL for resolution.
 * @returns Ranked absolute candidate URLs.
 */
export function candidatesFromScrapedLinks(
  links: readonly { href: string; rel?: string; sizes?: string }[],
  pageUrl: string
): string[] {
  return rankFaviconCandidates(
    links.map((link) => ({
      href: link.href,
      rel: link.rel,
      size: parseFaviconSizes(link.sizes)
    })),
    pageUrl
  );
}

/**
 * JavaScript source executed in the guest to collect favicon `<link>` elements.
 *
 * Returns a JSON-serializable array of `{ href, rel, sizes }`.
 *
 * @returns Script source for `executeJavaScript`.
 */
export function faviconScrapeScript(): string {
  return `(function () {
  var nodes = document.querySelectorAll(
    'link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]'
  );
  var out = [];
  for (var i = 0; i < nodes.length; i++) {
    var el = nodes[i];
    var href = el.getAttribute('href');
    if (!href) continue;
    out.push({
      href: href,
      rel: el.getAttribute('rel') || '',
      sizes: el.getAttribute('sizes') || ''
    });
  }
  return out;
})()`;
}

/**
 * Builds a data URL from raw image bytes and an optional Content-Type.
 *
 * @param buffer - Image bytes.
 * @param contentType - MIME type from the response, when present.
 * @returns Data URL string.
 */
export function bytesToFaviconDataUrl(buffer: Buffer, contentType?: string): string {
  const mime = normalizeImageMime(contentType) ?? sniffImageMime(buffer) ?? 'image/x-icon';
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

/**
 * Returns whether a Content-Type header looks like an image suitable for a favicon.
 *
 * @param contentType - Response Content-Type header value.
 * @returns True when the type is an image (or empty, deferred to sniffing).
 */
export function isAcceptableFaviconContentType(contentType: string | undefined): boolean {
  if (!contentType || !contentType.trim()) {
    return true;
  }
  const mime = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (mime === 'application/octet-stream') {
    return true;
  }
  return mime.startsWith('image/');
}

/**
 * Normalizes a Content-Type header to a bare image MIME type.
 *
 * @param contentType - Raw header value.
 * @returns MIME string or undefined.
 */
function normalizeImageMime(contentType: string | undefined): string | undefined {
  if (!contentType) {
    return undefined;
  }
  const mime = contentType.split(';')[0]?.trim().toLowerCase();
  if (!mime || mime === 'application/octet-stream') {
    return undefined;
  }
  if (!mime.startsWith('image/')) {
    return undefined;
  }
  return mime;
}

/**
 * Sniffs common favicon magic bytes when Content-Type is missing.
 *
 * @param buffer - Response body.
 * @returns Guessed MIME type or undefined.
 */
function sniffImageMime(buffer: Buffer): string | undefined {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return 'image/gif';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buffer.length >= 4 && buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0x01) {
    return 'image/x-icon';
  }
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === '<svg') {
    return 'image/svg+xml';
  }
  if (buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '<?xml') {
    return 'image/svg+xml';
  }
  return undefined;
}

/**
 * Short-lived in-memory favicon cache keyed by page origin.
 */
export class FaviconCache {
  readonly #ttlMs: number;
  readonly #entries = new Map<string, FaviconCacheEntry>();
  readonly #now: () => number;

  /**
   * Creates a favicon cache.
   *
   * @param ttlMs - Entry lifetime in milliseconds.
   * @param now - Clock function (injectable for tests).
   */
  constructor(ttlMs: number = FAVICON_CACHE_TTL_MS, now: () => number = () => Date.now()) {
    this.#ttlMs = ttlMs;
    this.#now = now;
  }

  /**
   * Returns a cached data URL for an origin when present and unexpired.
   *
   * @param origin - Cache key from {@link faviconCacheKeyForUrl}.
   * @returns Data URL or null on miss/expiry.
   */
  get(origin: string): string | null {
    const entry = this.#entries.get(origin);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt <= this.#now()) {
      this.#entries.delete(origin);
      return null;
    }
    return entry.dataUrl;
  }

  /**
   * Stores a favicon data URL for an origin with the configured TTL.
   *
   * @param origin - Cache key.
   * @param dataUrl - Data URL to store.
   */
  set(origin: string, dataUrl: string): void {
    this.#entries.set(origin, {
      dataUrl,
      expiresAt: this.#now() + this.#ttlMs
    });
  }

  /**
   * Removes all entries (tests / shutdown).
   */
  clear(): void {
    this.#entries.clear();
  }
}
