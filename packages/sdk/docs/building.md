# Building

HarborClient does not ship a plugin SDK runtime — you author and bundle plugins with your own toolchain.

## Packaging as `.hcp`

Create a ZIP archive and use the `.hcp` extension. Any zip tool works — for example:

```bash
cd request-logger
zip -r ../request-logger.hcp manifest.json README.md dist
```

You can also build `request-logger.zip` and rename it to `request-logger.hcp`; HarborClient treats both the same way at install time as long as the contents are a valid plugin layout.

## Recommended project setup

```json
{
  "name": "request-logger",
  "private": true,
  "devDependencies": {
    "@harborclient/sdk": "^0.2.0",
    "@types/react": "^19.0.0",
    "esbuild": "^0.25.0",
    "typescript": "^5.0.0"
  },
  "scripts": {
    "build": "esbuild src/main.ts --bundle --outfile=dist/main.js --format=esm --platform=neutral",
    "pack": "pnpm build && zip -r ../request-logger.hcp manifest.json README.md dist"
  }
}
```

For renderer plugins, mark `react` and `react-dom` as **external** and set `--jsx=automatic --jsx-import-source=@harborclient/sdk`. The host installs the shared React instance before `activate(hc)` runs. See [React and JSX](/renderer-overview#react-and-jsx).

## Sign your plugin

After building entry files, sign the plugin directory with an Ed25519 key so users can verify file integrity. See [Signing](/signing) for key generation, CLI usage, and the `signature.json` format.

## TypeScript

Use `jsx: react-jsx` with `jsxImportSource: '@harborclient/sdk'` and import types from `@harborclient/sdk`. Your entry module should export `activate` and optionally `deactivate` as named exports.

## Main entry

If your plugin includes HTTP hooks, add a separate build target for `src/main.ts` → `dist/main.js` and reference it in `manifest.json` under `"main"`. Main entries run in the SES utilityProcess; keep UI code in the renderer entry only.

See [Package layout](/package-layout) for the expected directory structure and [Dev workflow](/dev-workflow) for iterative development with unpacked loading.
