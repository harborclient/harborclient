import type { PluginFileHash, PluginSignaturePayload } from './types.js';
import { PLUGIN_SIGNATURE_ALGORITHM, PLUGIN_SIGNATURE_SCHEMA_VERSION } from './types.js';

/**
 * Builds the canonical signing payload object from manifest identity and file hashes.
 *
 * @param pluginId - Plugin manifest id.
 * @param pluginVersion - Plugin manifest version.
 * @param files - Sorted plugin file inventory.
 * @param keyId - Optional signing key label.
 */
export function buildSignaturePayload(
  pluginId: string,
  pluginVersion: string,
  files: PluginFileHash[],
  keyId?: string
): PluginSignaturePayload {
  const payload: PluginSignaturePayload = {
    schemaVersion: PLUGIN_SIGNATURE_SCHEMA_VERSION,
    pluginId,
    pluginVersion,
    algorithm: PLUGIN_SIGNATURE_ALGORITHM,
    files: [...files]
  };

  if (keyId?.trim()) {
    payload.keyId = keyId.trim();
  }

  return payload;
}

/**
 * Serializes a signing payload to canonical JSON bytes for Ed25519 signing.
 *
 * @param payload - Unsigned signature payload.
 */
export function canonicalizeSignaturePayload(payload: PluginSignaturePayload): Buffer {
  return Buffer.from(JSON.stringify(payload), 'utf8');
}

/**
 * Parses and validates a signature.json object read from disk.
 *
 * @param raw - Parsed JSON value.
 * @returns Validated signature file contents.
 * @throws When the payload shape is invalid.
 */
export function parsePluginSignatureFile(
  raw: unknown
): PluginSignaturePayload & { signature: string } {
  if (typeof raw !== 'object' || raw == null) {
    throw new Error('Plugin signature must be a JSON object.');
  }

  const record = raw as Record<string, unknown>;
  if (record.schemaVersion !== PLUGIN_SIGNATURE_SCHEMA_VERSION) {
    throw new Error(`Unsupported plugin signature schema version: ${String(record.schemaVersion)}`);
  }
  if (record.algorithm !== PLUGIN_SIGNATURE_ALGORITHM) {
    throw new Error(`Unsupported plugin signature algorithm: ${String(record.algorithm)}`);
  }
  if (typeof record.pluginId !== 'string' || record.pluginId.trim().length === 0) {
    throw new Error('Plugin signature is missing pluginId.');
  }
  if (typeof record.pluginVersion !== 'string' || record.pluginVersion.trim().length === 0) {
    throw new Error('Plugin signature is missing pluginVersion.');
  }
  if (typeof record.signature !== 'string' || record.signature.trim().length === 0) {
    throw new Error('Plugin signature is missing signature.');
  }
  if (!Array.isArray(record.files)) {
    throw new Error('Plugin signature files must be an array.');
  }

  const files = record.files.map((entry, index) => {
    if (typeof entry !== 'object' || entry == null) {
      throw new Error(`Plugin signature files[${index}] must be an object.`);
    }
    const fileRecord = entry as Record<string, unknown>;
    if (typeof fileRecord.path !== 'string' || fileRecord.path.trim().length === 0) {
      throw new Error(`Plugin signature files[${index}].path is invalid.`);
    }
    if (typeof fileRecord.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(fileRecord.sha256)) {
      throw new Error(`Plugin signature files[${index}].sha256 is invalid.`);
    }
    return {
      path: fileRecord.path,
      sha256: fileRecord.sha256.toLowerCase()
    };
  });

  const payload: PluginSignaturePayload & { signature: string } = {
    schemaVersion: PLUGIN_SIGNATURE_SCHEMA_VERSION,
    pluginId: record.pluginId,
    pluginVersion: record.pluginVersion,
    algorithm: PLUGIN_SIGNATURE_ALGORITHM,
    files,
    signature: record.signature
  };

  if (record.keyId != null) {
    if (typeof record.keyId !== 'string' || record.keyId.trim().length === 0) {
      throw new Error('Plugin signature keyId must be a non-empty string when present.');
    }
    payload.keyId = record.keyId.trim();
  }

  return payload;
}
