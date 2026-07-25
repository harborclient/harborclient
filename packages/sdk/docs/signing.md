# Plugin signing

HarborClient plugins can be signed with an Ed25519 key so installers can verify that plugin files match a publisher's signature. Signing is optional for third-party plugins; unsigned plugins may show a warning when enabled in HarborClient.

Authors listed in HarborClient's [trusted publisher registry](https://harborclient.com/plugins/trusted.json) must sign every plugin they publish. HarborClient rejects installs that claim a trusted author name without a valid signature.

To discuss becoming a trusted publisher, email [contact@harborclient.com](mailto:contact@harborclient.com).

The `@harborclient/sdk/signing` module provides programmatic signing and verification, plus CLI tools for release workflows.

## Generate a key pair

Use OpenSSL to create an Ed25519 private key and extract the public key:

```bash
openssl genpkey -algorithm ED25519 -out plugin-signing.pem
openssl pkey -in plugin-signing.pem -pubout -out plugin-signing.pub.pem
```

Keep the private key offline or in CI secrets. Distribute only the public key to users or verification tooling.

## Sign a plugin directory

From your plugin project (after building entry files into `dist/`):

```bash
pnpm plugin:sign -- --dir . --private-key ../plugin-signing.pem --key-id my-publisher
```

Or use the published CLI binaries:

```bash
pnpm exec hc-plugin-sign --dir . --private-key ../plugin-signing.pem --key-id my-publisher
```

This writes `signature.json` at the plugin root. The file lists every hashed file (excluding `signature.json`, `.git/`, `node_modules/`, and `.DS_Store`) and an Ed25519 signature over a canonical JSON payload.

Commit `signature.json` to your repository when users install from git, or ship it inside the `.hcp` archive for file-based installs.

## Verify a plugin directory

```bash
pnpm plugin:verify -- --dir . --public-key ../plugin-signing.pub.pem
```

Add `--allow-unsigned` to exit successfully when `signature.json` is absent (useful in CI before signing is enforced).

Exit codes:

| Code | Meaning                                               |
| ---- | ----------------------------------------------------- |
| `0`  | Signature valid (or unsigned with `--allow-unsigned`) |
| `1`  | CLI usage error                                       |
| `2`  | Sign failure                                          |
| `3`  | Invalid signature or tampered files                   |
| `4`  | Unsigned (without `--allow-unsigned`)                 |

## Programmatic API

Import from `@harborclient/sdk/signing`:

```typescript
import { signPlugin, verifyPlugin } from '@harborclient/sdk/signing';
import { readFileSync } from 'node:fs';

await signPlugin({
  pluginDir: './my-plugin',
  privateKeyPem: readFileSync('./plugin-signing.pem', 'utf8'),
  keyId: 'my-publisher'
});

const result = await verifyPlugin({
  pluginDir: './my-plugin',
  trustedPublicKeysPem: [readFileSync('./plugin-signing.pub.pem', 'utf8')]
});

if (result.status !== 'valid') {
  throw new Error(result.error ?? result.status);
}
```

Exported helpers useful for HarborClient runtime integration:

- `collectPluginFiles(pluginDir)` — sorted SHA-256 inventory
- `readPluginSignature(pluginDir)` — parse `signature.json` when present
- `PLUGIN_SIGNATURE_FILENAME` — `'signature.json'`

## signature.json format

```json
{
  "schemaVersion": 1,
  "pluginId": "com.example.my-plugin",
  "pluginVersion": "1.0.0",
  "algorithm": "Ed25519",
  "keyId": "my-publisher",
  "files": [
    { "path": "dist/renderer.js", "sha256": "..." },
    { "path": "manifest.json", "sha256": "..." }
  ],
  "signature": "<base64>"
}
```

The signed payload includes `schemaVersion`, `pluginId`, `pluginVersion`, `algorithm`, optional `keyId`, and the sorted `files` array. The `signature` field itself is excluded from the payload.

## Marketplace plugins

Official HarborClient plugins can commit `signature.json` alongside `manifest.json` in their GitHub repositories. HarborClient verifies signatures at install time against the trusted publisher registry.
