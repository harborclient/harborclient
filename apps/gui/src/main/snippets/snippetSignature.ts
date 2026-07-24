import { createPublicKey, verify } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  buildSignaturePayload,
  canonicalizeSignaturePayload,
  collectPluginFiles,
  parsePluginSignatureFile,
  PLUGIN_SIGNATURE_FILENAME,
  readPluginSignature
} from '@harborclient/sdk/signing';
import type { PluginSignatureInfo } from '#/shared/plugin/types';
import {
  evaluatePluginSignature,
  fetchPublicKeyPem,
  fetchTrustedKeys,
  PluginSignatureUnavailableError
} from '#/main/plugins/pluginSignature';
import type { SnippetManifest } from './manifestSchema';

/**
 * Reads bundle id and version from snippets.json for signature verification.
 *
 * @param directory - Snippet repository root containing snippets.json.
 * @returns Parsed identity fields.
 * @throws When snippets.json is missing, invalid JSON, or fails validation.
 */
export function readSnippetManifestIdentity(directory: string): { id: string; version: string } {
  const manifestPath = join(directory, 'snippets.json');
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(`Snippet manifest is not valid JSON: ${manifestPath}`, { cause: error });
  }

  if (typeof raw !== 'object' || raw == null) {
    throw new Error(`Snippet manifest must be a JSON object: ${manifestPath}`);
  }

  const record = raw as Record<string, unknown>;
  const id = record.id;
  const version = record.version;
  const idPattern = /^[a-zA-Z][a-zA-Z0-9.-]*\.[a-zA-Z][a-zA-Z0-9.-]+$/;

  if (typeof id !== 'string' || !idPattern.test(id)) {
    throw new Error(`Snippet manifest id is invalid: ${manifestPath}`);
  }
  if (typeof version !== 'string' || version.trim().length === 0) {
    throw new Error(`Snippet manifest version is invalid: ${manifestPath}`);
  }

  return { id, version };
}

/**
 * Verifies signature.json against snippets.json identity and trusted public keys.
 *
 * @param directory - Snippet repository root directory.
 * @param trustedPublicKeysPem - Trusted publisher public keys.
 * @returns Verification status with optional error detail.
 */
async function verifySnippetPackageDirectory(
  directory: string,
  trustedPublicKeysPem: string[]
): Promise<{ status: 'unsigned' | 'valid' | 'invalid'; error?: string }> {
  const packageDir = resolve(directory);
  const signaturePath = resolve(packageDir, PLUGIN_SIGNATURE_FILENAME);
  if (!existsSync(signaturePath)) {
    return { status: 'unsigned' };
  }

  let signature;
  try {
    const raw = JSON.parse(readFileSync(signaturePath, 'utf8'));
    signature = parsePluginSignatureFile(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 'invalid', error: message };
  }

  let manifestIdentity;
  try {
    manifestIdentity = readSnippetManifestIdentity(packageDir);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 'invalid', error: message };
  }

  if (signature.pluginId !== manifestIdentity.id) {
    return {
      status: 'invalid',
      error: `Signature pluginId "${signature.pluginId}" does not match snippets.json id "${manifestIdentity.id}".`
    };
  }

  if (signature.pluginVersion !== manifestIdentity.version) {
    return {
      status: 'invalid',
      error: `Signature pluginVersion "${signature.pluginVersion}" does not match snippets.json version "${manifestIdentity.version}".`
    };
  }

  const currentFiles = collectPluginFiles(packageDir);
  if (
    signature.files.length !== currentFiles.length ||
    signature.files.some(
      (entry, index) =>
        entry.path !== currentFiles[index]?.path || entry.sha256 !== currentFiles[index]?.sha256
    )
  ) {
    return { status: 'invalid', error: 'Snippet package files do not match the signed inventory.' };
  }

  const payload = buildSignaturePayload(
    signature.pluginId,
    signature.pluginVersion,
    signature.files,
    signature.keyId
  );
  const payloadBytes = canonicalizeSignaturePayload(payload);
  const signatureBytes = new Uint8Array(Buffer.from(signature.signature, 'base64'));

  for (const publicKeyPem of trustedPublicKeysPem) {
    try {
      const publicKey = createPublicKey(publicKeyPem);
      if (verify(null, new Uint8Array(payloadBytes), publicKey, signatureBytes)) {
        return { status: 'valid' };
      }
    } catch {
      continue;
    }
  }

  return {
    status: 'invalid',
    error: 'Snippet package signature failed verification against all trusted public keys.'
  };
}

/**
 * Evaluates a snippet repository directory against the trusted publisher registry and
 * on-disk signature.json when present.
 *
 * @param directory - Absolute snippet repository root directory.
 * @param manifest - Parsed snippets.json used for author matching.
 * @returns Signature status metadata for UI and install gating.
 * @throws {@link PluginSignatureUnavailableError} When a signed bundle cannot be checked
 *   because the registry or key URL is unreachable.
 */
export async function evaluateSnippetSignature(
  directory: string,
  manifest: SnippetManifest
): Promise<PluginSignatureInfo> {
  const signatureFile = readPluginSignature(directory);
  const author = manifest.author?.trim();

  if (!signatureFile && !author) {
    return { status: 'unsigned' };
  }

  let trustedKeys;
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
        error: `This snippet bundle claims to be published by "${author}", a verified publisher, but is not signed. Only "${author}" can publish bundles under that name.`
      };
    }

    return { status: 'unsigned' };
  }

  if (!author) {
    return {
      status: 'untrusted',
      error: 'Snippet manifest is missing author metadata required for signature verification.'
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

  const verification = await verifySnippetPackageDirectory(directory, [publicKeyPem]);
  if (verification.status === 'valid') {
    return {
      status: 'verified',
      author,
      keyId: signatureFile.keyId
    };
  }

  return {
    status: 'invalid',
    author,
    keyId: signatureFile.keyId,
    error: verification.error ?? 'Snippet package signature failed verification.'
  };
}

/**
 * Evaluates a snippet repository that also ships manifest.json for plugin-style signing.
 *
 * Falls back to snippets.json verification when manifest.json is absent.
 *
 * @param directory - Absolute snippet repository root directory.
 * @param manifest - Parsed snippets.json used for author matching.
 * @returns Signature status metadata for UI and install gating.
 */
export async function evaluateSnippetPackageSignature(
  directory: string,
  manifest: SnippetManifest
): Promise<PluginSignatureInfo> {
  const manifestPath = join(directory, 'manifest.json');
  if (existsSync(manifestPath)) {
    try {
      const pluginManifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
        id?: string;
        version?: string;
        author?: string;
      };
      if (pluginManifest.id === manifest.id && pluginManifest.version === manifest.version) {
        return evaluatePluginSignature(directory, {
          id: manifest.id,
          name: manifest.name,
          version: manifest.version,
          author: manifest.author,
          engines: manifest.engines,
          permissions: ['ui']
        });
      }
    } catch {
      // Fall through to snippets.json verification.
    }
  }

  return evaluateSnippetSignature(directory, manifest);
}
