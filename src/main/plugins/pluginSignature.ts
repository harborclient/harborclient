import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import { readPluginSignature, verifyPlugin } from '@harborclient/plugin-api/signing';
import {
  parsePluginTrustedKeys,
  PLUGIN_TRUSTED_KEYS_URL,
  type PluginTrustedKeys
} from '#/shared/plugin/catalog';
import type { PluginManifest, PluginSignatureInfo } from '#/shared/plugin/types';

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
 * Fetches the public trusted plugin signing key registry, falling back to the
 * local repository file when harborclient.com is unreachable.
 *
 * @returns Parsed trusted key entries for publisher matching.
 * @throws {@link PluginSignatureUnavailableError} When neither remote nor local
 *   trusted keys can be loaded.
 */
export async function fetchTrustedKeys(): Promise<PluginTrustedKeys> {
  if (cachedTrustedKeys) {
    return cachedTrustedKeys;
  }

  try {
    const response = await fetch(PLUGIN_TRUSTED_KEYS_URL, {
      headers: {
        Accept: 'application/json'
      }
    });

    if (response.ok) {
      const raw: unknown = await response.json();
      cachedTrustedKeys = parsePluginTrustedKeys(raw);
      return cachedTrustedKeys;
    }
  } catch {
    // Network errors fall through to the local registry.
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
 * Clears in-memory trusted key caches so tests can stub fetch independently.
 */
export function clearPluginSignatureCachesForTesting(): void {
  cachedTrustedKeys = null;
  publicKeyCache.clear();
}

/**
 * Evaluates a plugin directory against the trusted publisher registry and on-disk
 * signature.json when present.
 *
 * @param directory - Absolute plugin root directory.
 * @param manifest - Parsed plugin manifest used for company matching.
 * @returns Signature status metadata for UI and install gating.
 * @throws {@link PluginSignatureUnavailableError} When a signed plugin cannot be
 *   checked because the registry or key URL is unreachable.
 */
export async function evaluatePluginSignature(
  directory: string,
  manifest: PluginManifest
): Promise<PluginSignatureInfo> {
  const signatureFile = readPluginSignature(directory);
  const company = manifest.company?.trim();

  if (!signatureFile && !company) {
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

  const trustedEntry = company ? trustedKeys.find((entry) => entry.company === company) : undefined;

  if (!signatureFile) {
    if (trustedEntry) {
      return {
        status: 'untrusted',
        company,
        error: `This plugin claims to be published by "${company}", a verified publisher, but is not signed. Only "${company}" can publish plugins under that name.`
      };
    }

    return { status: 'unsigned' };
  }

  if (!company) {
    return {
      status: 'untrusted',
      error: 'Plugin manifest is missing company metadata required for signature verification.'
    };
  }

  if (!trustedEntry) {
    return {
      status: 'untrusted',
      company,
      error: `No trusted signing key is registered for publisher "${company}".`
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
      `Could not download trusted public key for publisher "${company}".`,
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
      company,
      keyId: verification.keyId ?? verification.signature?.keyId
    };
  }

  return {
    status: 'invalid',
    company,
    keyId: verification.signature?.keyId,
    error: verification.error ?? 'Plugin signature failed verification.'
  };
}
