/**
 * Filename written at the plugin root when a package is signed.
 */
export const PLUGIN_SIGNATURE_FILENAME = 'signature.json';

/**
 * Supported plugin signature schema version.
 */
export const PLUGIN_SIGNATURE_SCHEMA_VERSION = 1;

/**
 * Signature algorithm stored in signature.json.
 */
export const PLUGIN_SIGNATURE_ALGORITHM = 'Ed25519' as const;

/**
 * One hashed file entry in a plugin signature inventory.
 */
export interface PluginFileHash {
  path: string;
  sha256: string;
}

/**
 * Parsed plugin signature.json on disk (excluding runtime-only fields).
 */
export interface PluginSignatureFile {
  schemaVersion: typeof PLUGIN_SIGNATURE_SCHEMA_VERSION;
  pluginId: string;
  pluginVersion: string;
  algorithm: typeof PLUGIN_SIGNATURE_ALGORITHM;
  keyId?: string;
  files: PluginFileHash[];
  signature: string;
}

/**
 * Payload signed by Ed25519 before the signature field is attached.
 */
export interface PluginSignaturePayload {
  schemaVersion: typeof PLUGIN_SIGNATURE_SCHEMA_VERSION;
  pluginId: string;
  pluginVersion: string;
  algorithm: typeof PLUGIN_SIGNATURE_ALGORITHM;
  keyId?: string;
  files: PluginFileHash[];
}

/**
 * Result of verifying a plugin signature.
 */
export type PluginVerifyStatus = 'valid' | 'unsigned' | 'invalid';

/**
 * Options for {@link signPlugin}.
 */
export interface SignPluginOptions {
  /** Absolute or relative path to the plugin root directory. */
  pluginDir: string;
  /** PEM-encoded Ed25519 private key. */
  privateKeyPem: string;
  /** Optional label stored in signature.json to identify the signing key. */
  keyId?: string;
  /** Override path for signature.json (default: `<pluginDir>/signature.json`). */
  signaturePath?: string;
}

/**
 * Result returned after writing a plugin signature file.
 */
export interface SignPluginResult {
  signaturePath: string;
  signature: PluginSignatureFile;
}

/**
 * Options for {@link verifyPlugin}.
 */
export interface VerifyPluginOptions {
  /** Absolute or relative path to the plugin root directory. */
  pluginDir: string;
  /** PEM-encoded Ed25519 public keys trusted for verification. */
  trustedPublicKeysPem: string[];
  /** Override path for signature.json (default: `<pluginDir>/signature.json`). */
  signaturePath?: string;
}

/**
 * Result returned after verifying a plugin signature.
 */
export interface VerifyPluginResult {
  status: PluginVerifyStatus;
  signature?: PluginSignatureFile;
  keyId?: string;
  error?: string;
}
