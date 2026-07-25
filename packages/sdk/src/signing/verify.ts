import { createPublicKey, verify } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildSignaturePayload,
  canonicalizeSignaturePayload,
  parsePluginSignatureFile
} from './canonical.js';
import { assertPluginDirectory, collectPluginFiles } from './inventory.js';
import { readPluginManifestIdentity } from './manifest.js';
import { PLUGIN_SIGNATURE_FILENAME } from './types.js';
import type { PluginSignatureFile, VerifyPluginOptions, VerifyPluginResult } from './types.js';

/**
 * Reads signature.json from a plugin directory when present.
 *
 * @param pluginDir - Plugin root directory.
 * @returns Parsed signature file or null when signature.json is absent.
 * @throws When signature.json exists but is invalid JSON or shape.
 */
export function readPluginSignature(pluginDir: string): PluginSignatureFile | null {
  const signaturePath = resolve(pluginDir, PLUGIN_SIGNATURE_FILENAME);
  if (!existsSync(signaturePath)) {
    return null;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(signaturePath, 'utf8')) as unknown;
  } catch (error) {
    throw new Error(`Plugin signature is not valid JSON: ${signaturePath}`, { cause: error });
  }

  return parsePluginSignatureFile(raw);
}

/**
 * Verifies a plugin signature against trusted public keys and on-disk file hashes.
 *
 * @param options - Plugin directory and trusted public key options.
 * @returns Verification status with optional error detail.
 */
export async function verifyPlugin(options: VerifyPluginOptions): Promise<VerifyPluginResult> {
  const pluginDir = resolve(options.pluginDir);
  assertPluginDirectory(pluginDir);

  const signaturePath = resolve(
    options.signaturePath ?? resolve(pluginDir, PLUGIN_SIGNATURE_FILENAME)
  );
  if (!existsSync(signaturePath)) {
    return { status: 'unsigned' };
  }

  let signature: PluginSignatureFile;
  try {
    const raw = JSON.parse(readFileSync(signaturePath, 'utf8')) as unknown;
    signature = parsePluginSignatureFile(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 'invalid', error: message };
  }

  let manifestIdentity;
  try {
    manifestIdentity = readPluginManifestIdentity(pluginDir);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 'invalid', signature, error: message };
  }

  if (signature.pluginId !== manifestIdentity.id) {
    return {
      status: 'invalid',
      signature,
      error: `Signature pluginId "${signature.pluginId}" does not match manifest id "${manifestIdentity.id}".`
    };
  }

  if (signature.pluginVersion !== manifestIdentity.version) {
    return {
      status: 'invalid',
      signature,
      error: `Signature pluginVersion "${signature.pluginVersion}" does not match manifest version "${manifestIdentity.version}".`
    };
  }

  const currentFiles = collectPluginFiles(pluginDir);
  if (!fileInventoriesMatch(signature.files, currentFiles)) {
    return {
      status: 'invalid',
      signature,
      error: 'Plugin files do not match the signed inventory.'
    };
  }

  const payload = buildSignaturePayload(
    signature.pluginId,
    signature.pluginVersion,
    signature.files,
    signature.keyId
  );
  const payloadBytes = canonicalizeSignaturePayload(payload);
  const signatureBytes = new Uint8Array(Buffer.from(signature.signature, 'base64'));

  if (options.trustedPublicKeysPem.length === 0) {
    return {
      status: 'invalid',
      signature,
      error: 'At least one trusted public key is required for verification.'
    };
  }

  for (const publicKeyPem of options.trustedPublicKeysPem) {
    try {
      const publicKey = createPublicKey(publicKeyPem);
      if (verify(null, new Uint8Array(payloadBytes), publicKey, signatureBytes)) {
        return {
          status: 'valid',
          signature,
          keyId: signature.keyId
        };
      }
    } catch {
      continue;
    }
  }

  return {
    status: 'invalid',
    signature,
    error: 'Plugin signature failed verification against all trusted public keys.'
  };
}

/**
 * Returns true when two plugin inventories contain identical path/hash pairs.
 *
 * @param signedFiles - File inventory stored in signature.json.
 * @param currentFiles - File inventory computed from disk.
 */
function fileInventoriesMatch(
  signedFiles: PluginSignatureFile['files'],
  currentFiles: PluginSignatureFile['files']
): boolean {
  if (signedFiles.length !== currentFiles.length) {
    return false;
  }

  for (let index = 0; index < signedFiles.length; index += 1) {
    if (
      signedFiles[index].path !== currentFiles[index].path ||
      signedFiles[index].sha256 !== currentFiles[index].sha256
    ) {
      return false;
    }
  }

  return true;
}
