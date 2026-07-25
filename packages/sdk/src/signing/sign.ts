import { createPrivateKey, sign } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSignaturePayload, canonicalizeSignaturePayload } from './canonical.js';
import { assertPluginDirectory, collectPluginFiles } from './inventory.js';
import { readPluginManifestIdentity } from './manifest.js';
import { PLUGIN_SIGNATURE_FILENAME } from './types.js';
import type { SignPluginOptions, SignPluginResult } from './types.js';

/**
 * Signs a plugin directory and writes signature.json beside manifest.json.
 *
 * @param options - Plugin directory and signing key options.
 * @returns Path to the written signature file and parsed signature contents.
 * @throws When manifest validation, inventory, or signing fails.
 */
export async function signPlugin(options: SignPluginOptions): Promise<SignPluginResult> {
  const pluginDir = resolve(options.pluginDir);
  assertPluginDirectory(pluginDir);

  const { id, version } = readPluginManifestIdentity(pluginDir);
  const files = collectPluginFiles(pluginDir);
  const payload = buildSignaturePayload(id, version, files, options.keyId);
  const payloadBytes = canonicalizeSignaturePayload(payload);

  let privateKey;
  try {
    privateKey = createPrivateKey(options.privateKeyPem);
  } catch (error) {
    throw new Error('Invalid Ed25519 private key', { cause: error });
  }

  const signature = sign(null, new Uint8Array(payloadBytes), privateKey).toString('base64');
  const signatureFile = {
    ...payload,
    signature
  };

  const signaturePath = resolve(options.signaturePath ?? joinSignaturePath(pluginDir));
  writeFileSync(signaturePath, `${JSON.stringify(signatureFile, null, 2)}\n`, 'utf8');

  return {
    signaturePath,
    signature: signatureFile
  };
}

/**
 * Returns the default signature.json path for one plugin directory.
 *
 * @param pluginDir - Plugin root directory.
 */
function joinSignaturePath(pluginDir: string): string {
  return resolve(pluginDir, PLUGIN_SIGNATURE_FILENAME);
}
