export {
  PLUGIN_SIGNATURE_ALGORITHM,
  PLUGIN_SIGNATURE_FILENAME,
  PLUGIN_SIGNATURE_SCHEMA_VERSION
} from './types.js';
export type {
  PluginFileHash,
  PluginSignatureFile,
  PluginSignaturePayload,
  PluginVerifyStatus,
  SignPluginOptions,
  SignPluginResult,
  VerifyPluginOptions,
  VerifyPluginResult
} from './types.js';

export { readPluginManifestIdentity } from './manifest.js';
export type { PluginManifestIdentity } from './manifest.js';

export { assertPluginDirectory, collectPluginFiles, shouldExcludePluginPath } from './inventory.js';

export {
  buildSignaturePayload,
  canonicalizeSignaturePayload,
  parsePluginSignatureFile
} from './canonical.js';

export { signPlugin } from './sign.js';
export { readPluginSignature, verifyPlugin } from './verify.js';
export { runSignCli, runVerifyCli } from './cli.js';
