# HarborClient plugins directory

This folder holds marketplace metadata and official plugin signing keys.

| File               | In git | Purpose                                                                                                                                                                   |
| ------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog.json`     | Yes    | Source for the [plugin marketplace](https://harborclient.com/plugins)                                                                                                     |
| `trusted.json`     | Yes    | Registry of trusted plugin signing key URLs (published at [harborclient.com/plugins/trusted.json](https://harborclient.com/plugins/trusted.json))                         |
| `harborclient.key` | Yes    | Ed25519 public key for verifying official plugin signatures (published at [harborclient.com/plugins/harborclient.key](https://harborclient.com/plugins/harborclient.key)) |
| `signing.pem`      | **No** | Ed25519 private key for signing official plugins — generate locally, never commit                                                                                         |

Apps and verification tools fetch `trusted.json`, download each listed `key` URL (PEM), and use those public keys to verify plugin `signature.json` files.

## Trusted publisher signing requirement

Any company listed in `trusted.json` **must** sign every published plugin with the matching private key. HarborClient rejects installs when `manifest.company` matches a trusted publisher but the plugin is unsigned or the signature is invalid. Only one developer can claim each protected company name.

Third-party plugins that do not use a trusted company name may remain unsigned; users see a warning before enabling them.

## Generate the signing key pair

If you do not already have `signing.pem`:

```bash
openssl genpkey -algorithm ED25519 -out plugins/signing.pem
openssl pkey -in plugins/signing.pem -pubout -out plugins/harborclient.key
```

Commit `harborclient.key` and update `trusted.json` after generation or rotation. Keep `signing.pem` on your machine or in CI secrets only.

## Sign and verify official plugins

From the HarborClient repository root:

```bash
pnpm plugin:sign -- --dir /path/to/plugin --private-key plugins/signing.pem --key-id harborclient-official
pnpm plugin:verify -- --dir /path/to/plugin --public-key plugins/harborclient.key
```

The docs build copies `harborclient.key` and `trusted.json` into the static site so they are available at the URLs above.
