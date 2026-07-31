import { Agent } from 'undici';
import { load as parseYaml } from 'js-yaml';
import { getGeneralSettings } from '#/main/settings/generalSettings';
import { canImportOpenCollection, parseOpenCollectionDocument } from '#/main/import/opencollection';

/**
 * Network timeout for collection URL downloads.
 */
const FETCH_TIMEOUT_MS = 30_000;

/**
 * Shared undici Agent that skips TLS certificate verification when the user
 * has disabled "Verify SSL certificates" in general settings.
 */
let insecureDispatcher: Agent | undefined;

/**
 * Returns a shared undici Agent that skips TLS certificate verification.
 *
 * @returns Cached insecure Agent instance.
 */
function getInsecureDispatcher(): Agent {
  insecureDispatcher ??= new Agent({ connect: { rejectUnauthorized: false } });
  return insecureDispatcher;
}

/**
 * Result of downloading and parsing a collection document from a remote URL.
 */
export interface FetchedCollectionDocument {
  /**
   * Absolute URL that was fetched.
   */
  sourceUrl: string;

  /**
   * Parsed JSON/YAML document ready for format detection and conversion.
   */
  parsed: unknown;

  /**
   * Suggested collection/file name derived from the URL path, when available.
   */
  fileName?: string;
}

/**
 * Validates and normalizes a collection import URL.
 *
 * @param url - User-supplied URL string.
 * @returns Absolute http(s) URL.
 * @throws When the URL is empty or not an http(s) absolute URL.
 */
export function normalizeCollectionImportUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error('Enter a URL to import.');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Enter a valid absolute URL (http:// or https://).');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Collection URLs must use http:// or https://.');
  }

  return parsed.toString();
}

/**
 * Derives a file-name stem from a URL path for HAR naming and import context.
 *
 * @param sourceUrl - Absolute URL that was fetched.
 * @returns File name without extension, or undefined when the path has none.
 */
function fileNameFromUrl(sourceUrl: string): string | undefined {
  try {
    const pathname = new URL(sourceUrl).pathname;
    const base = pathname.split('/').filter(Boolean).pop();
    if (!base) {
      return undefined;
    }
    return base.replace(/\.(json|ya?ml|har)$/i, '') || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Parses raw response text as JSON, YAML, or an OpenCollection document.
 *
 * @param text - Raw UTF-8 response body.
 * @returns Parsed document object.
 * @throws When the body cannot be parsed as a supported collection format.
 */
export function parseCollectionUrlContents(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('The URL returned an empty response.');
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    // Fall through to YAML / OpenCollection parsing.
  }

  if (canImportOpenCollection(trimmed)) {
    return parseOpenCollectionDocument(trimmed);
  }

  try {
    const yamlParsed = parseYaml(trimmed) as unknown;
    if (yamlParsed != null && typeof yamlParsed === 'object') {
      return yamlParsed;
    }
  } catch {
    // Fall through to the final error.
  }

  throw new Error(
    'Could not parse the URL response as JSON or YAML. Supported formats: HarborClient, Postman, OpenCollection, or HAR.'
  );
}

/**
 * Downloads a collection document from a remote URL and parses it.
 *
 * Honors the global "Verify SSL certificates" setting so self-signed hosts
 * work when the user has disabled verification.
 *
 * @param url - Absolute http(s) URL to fetch.
 * @returns Parsed document with source URL metadata.
 * @throws When the URL is invalid, the request fails, or the body cannot be parsed.
 */
export async function fetchCollectionFromUrl(url: string): Promise<FetchedCollectionDocument> {
  const sourceUrl = normalizeCollectionImportUrl(url);
  const verifySsl = getGeneralSettings().verifySsl !== false;

  const init: RequestInit & { dispatcher?: Agent } = {
    headers: {
      Accept: 'application/json, application/yaml, text/yaml, text/plain, */*'
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  };

  if (!verifySsl) {
    init.dispatcher = getInsecureDispatcher();
  }

  let response: Response;
  try {
    response = await fetch(sourceUrl, init);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to download collection: ${message}`);
  }

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}): ${sourceUrl}`);
  }

  const text = await response.text();
  const parsed = parseCollectionUrlContents(text);

  return {
    sourceUrl,
    parsed,
    fileName: fileNameFromUrl(sourceUrl)
  };
}
