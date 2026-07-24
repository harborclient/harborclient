import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import { readPluginSignature, verifyPlugin } from '@harborclient/sdk/signing';
import {
  parsePluginTrustedKeys,
  type PluginTrustedKeyEntry,
  type PluginTrustedKeys
} from '#/shared/plugin/catalog';
import type { PluginManifest, PluginSignatureInfo } from '#/shared/plugin/types';
import { getEnabledTrustedUrls } from '#/main/settings/pluginSourcesSettings';

/**
 * Thrown when the trusted key registry or a publisher public key cannot be fetched.
 */
export class PluginSignatureUnavailableError extends Error {
  /**
   * @param message - User-facing explanation of the fetch failure.
   * @param options - Optional error cause chain.
   */
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'PluginSignatureUnavailableError';
  }
}

let cachedTrustedKeys: PluginTrustedKeys | null = null;
const publicKeyCache = new Map<string, string>();

/**
 * Candidate filesystem paths for the trusted key registry used when the remote
 * JSON is unavailable.
 *
 * @returns Absolute paths to try in priority order.
 */
export function getLocalPluginTrustedKeysPaths(): string[] {
  const paths = new Set<string>();

  if (app.isPackaged) {
    paths.add(join(process.resourcesPath, 'plugins/trusted.json'));
  }

  paths.add(join(app.getAppPath(), 'plugins/trusted.json'));
  paths.add(join(__dirname, '../../plugins/trusted.json'));

  return [...paths];
}

/**
 * Reads and validates the bundled or repository trusted key registry from disk.
 *
 * @param paths - Optional override list of trusted.json paths for tests.
 * @returns Parsed trusted keys when a readable file is found.
 */
export function readLocalPluginTrustedKeys(
  paths = getLocalPluginTrustedKeysPaths()
): PluginTrustedKeys | null {
  for (const trustedPath of paths) {
    if (!existsSync(trustedPath)) {
      continue;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(trustedPath, 'utf8')) as unknown;
    } catch {
      continue;
    }

    try {
      return parsePluginTrustedKeys(raw);
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Fetches the public trusted plugin signing key registry from all enabled
 * sources, falling back to the local repository file when harborclient.com is
 * unreachable.
 *
 * @param trustedUrls - Optional override list of trusted.json URLs for tests.
 * @returns Parsed trusted key entries for publisher matching.
 * @throws {@link PluginSignatureUnavailableError} When neither remote nor local
 *   trusted keys can be loaded.
 */
export async function fetchTrustedKeys(trustedUrls?: string[]): Promise<PluginTrustedKeys> {
  if (cachedTrustedKeys) {
    return cachedTrustedKeys;
  }

  const urls = trustedUrls ?? getEnabledTrustedUrls();
  const fetched: PluginTrustedKeys[] = [];

  for (const url of urls) {
    const registry = await fetchTrustedKeysFromUrl(url);
    if (registry) {
      fetched.push(registry);
    }
  }

  if (fetched.length > 0) {
    cachedTrustedKeys = mergePluginTrustedKeys(fetched);
    return cachedTrustedKeys;
  }

  const local = readLocalPluginTrustedKeys();
  if (local) {
    cachedTrustedKeys = local;
    return local;
  }

  throw new PluginSignatureUnavailableError(
    'Could not reach the trusted plugin key registry and no local trusted keys were found.'
  );
}

/**
 * Clears in-memory trusted key caches so tests can stub fetch independently.
 */
export function clearPluginSignatureCachesForTesting(): void {
  clearTrustedKeysCache();
  publicKeyCache.clear();
}

/**
 * Downloads one PEM-encoded public key from an HTTPS URL with session caching.
 *
 * @param url - Trusted public key URL from trusted.json.
 * @returns Trimmed PEM public key contents.
 * @throws {@link PluginSignatureUnavailableError} When the URL is invalid or
 *   the key cannot be downloaded.
 */
export async function fetchPublicKeyPem(url: string): Promise<string> {
  const cached = publicKeyCache.get(url);
  if (cached) {
    return cached;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new PluginSignatureUnavailableError(`Trusted key URL is not valid: ${url}`);
  }

  if (parsed.protocol !== 'https:') {
    throw new PluginSignatureUnavailableError(`Trusted key URL must use https://: ${url}`);
  }

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/x-pem-file, text/plain, */*'
      }
    });

    if (!response.ok) {
      throw new PluginSignatureUnavailableError(
        `Failed to download trusted public key (${response.status}): ${url}`
      );
    }

    const pem = (await response.text()).trim();
    if (!pem.includes('BEGIN PUBLIC KEY')) {
      throw new PluginSignatureUnavailableError(`Trusted public key is not valid PEM: ${url}`);
    }

    publicKeyCache.set(url, pem);
    return pem;
  } catch (error) {
    if (error instanceof PluginSignatureUnavailableError) {
      throw error;
    }

    throw new PluginSignatureUnavailableError(`Could not download trusted public key: ${url}`, {
      cause: error
    });
  }
}

/**
 * Fetches and parses one trusted plugin signing key registry from a remote URL.
 *
 * @param url - trusted.json endpoint.
 * @returns Parsed trusted keys when the request succeeds and the payload is valid.
 */
async function fetchTrustedKeysFromUrl(url: string): Promise<PluginTrustedKeys | null> {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      return null;
    }

    const raw: unknown = await response.json();
    return parsePluginTrustedKeys(raw);
  } catch {
    return null;
  }
}

/**
 * Merges trusted plugin signing key entries from multiple sources, keeping the
 * first occurrence of each key URL.
 *
 * @param registries - Parsed trusted key registries in fetch priority order.
 * @returns Combined trusted keys with deduplicated key URLs.
 */
export function mergePluginTrustedKeys(registries: PluginTrustedKeys[]): PluginTrustedKeys {
  const seen = new Set<string>();
  const merged: PluginTrustedKeyEntry[] = [];

  for (const registry of registries) {
    for (const entry of registry) {
      if (seen.has(entry.key)) {
        continue;
      }
      seen.add(entry.key);
      merged.push(entry);
    }
  }

  return merged;
}

/**
 * Clears in-memory trusted key caches so updated source settings take effect.
 */
export function clearTrustedKeysCache(): void {
  cachedTrustedKeys = null;
}

/**
 * Evaluates a plugin directory against the trusted publisher registry and on-disk
 * signature.json when present.
 *
 * @param directory - Absolute plugin root directory.
 * @param manifest - Parsed plugin manifest used for author matching.
 * @returns Signature status metadata for UI and install gating.
 * @throws {@link PluginSignatureUnavailableError} When a signed plugin cannot be
 *   checked because the registry or key URL is unreachable.
 */
export async function evaluatePluginSignature(
  directory: string,
  manifest: PluginManifest
): Promise<PluginSignatureInfo> {
  const signatureFile = readPluginSignature(directory);
  const author = manifest.author?.trim();

  if (!signatureFile && !author) {
    return { status: 'unsigned' };
  }

  let trustedKeys: PluginTrustedKeys;
  try {
    trustedKeys = await fetchTrustedKeys();
  } catch (error) {
    if (error instanceof PluginSignatureUnavailableError) {
      throw error;
    }

    throw new PluginSignatureUnavailableError('Could not reach the trusted plugin key registry.', {
      cause: error
    });
  }

  const trustedEntry = author ? trustedKeys.find((entry) => entry.author === author) : undefined;

  if (!signatureFile) {
    if (trustedEntry) {
      return {
        status: 'untrusted',
        author,
        error: `This plugin claims to be published by "${author}", a verified publisher, but is not signed. Only "${author}" can publish plugins under that name.`
      };
    }

    return { status: 'unsigned' };
  }

  if (!author) {
    return {
      status: 'untrusted',
      error: 'Plugin manifest is missing author metadata required for signature verification.'
    };
  }

  if (!trustedEntry) {
    return {
      status: 'untrusted',
      author,
      error: `No trusted signing key is registered for publisher "${author}".`
    };
  }

  let publicKeyPem: string;
  try {
    publicKeyPem = await fetchPublicKeyPem(trustedEntry.key);
  } catch (error) {
    if (error instanceof PluginSignatureUnavailableError) {
      throw error;
    }

    throw new PluginSignatureUnavailableError(
      `Could not download trusted public key for publisher "${author}".`,
      { cause: error }
    );
  }

  const verification = await verifyPlugin({
    pluginDir: directory,
    trustedPublicKeysPem: [publicKeyPem]
  });

  if (verification.status === 'valid') {
    return {
      status: 'verified',
      author,
      keyId: verification.keyId ?? verification.signature?.keyId
    };
  }

  return {
    status: 'invalid',
    author,
    keyId: verification.signature?.keyId,
    error: verification.error ?? 'Plugin signature failed verification.'
  };
}
