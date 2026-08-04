# Building

Build output is what HarborClient loads at runtime. Your plugin source can live in TypeScript, JSX, or plain JavaScript, but the plugin folder must contain a `manifest.json` at the root and bundled files under paths referenced by that manifest, usually `dist/renderer.js` and optionally `dist/main.js`.

HarborClient does not ship a plugin SDK runtime or build step. Use your plugin project's own `package.json` scripts to install tools, bundle source files, and create the `.hcp` archive when you are ready to distribute.

## Recommended project setup

Create a plugin project folder, then put `manifest.json` and `package.json` next to each other at the folder root. The manifest tells HarborClient which built files to load. The `package.json` is only for your development toolchain: dependencies, `pnpm` scripts, and packaging commands.

For example, a renderer plugin can start with this layout:

```
request-logger/
├── manifest.json
├── package.json
├── README.md
├── src/
│   └── renderer.tsx
└── dist/
```

Reference the built renderer file from `manifest.json`:

```json
{
  "id": "com.example.request-logger",
  "name": "Request Logger",
  "version": "1.0.0",
  "renderer": "dist/renderer.js",
  "permissions": ["ui", "storage"]
}
```

Then add build scripts to the root `package.json`:

```json
{
  "name": "request-logger",
  "private": true,
  "type": "module",
  "devDependencies": {
    "@harborclient/sdk": "^0.2.0",
    "@types/react": "^19.0.0",
    "esbuild": "^0.25.0",
    "typescript": "^5.0.0"
  },
  "scripts": {
    "build": "pnpm build:renderer",
    "build:renderer": "esbuild src/renderer.tsx --bundle --outfile=dist/renderer.js --format=esm --jsx=automatic --jsx-import-source=@harborclient/sdk --external:react --external:react-dom",
    "dev": "pnpm build:renderer --watch",
    "pack:hcp": "pnpm build && zip -r ../request-logger.hcp manifest.json README.md dist"
  }
}
```

For renderer plugins, mark `react` and `react-dom` as **external** and set `--jsx=automatic --jsx-import-source=@harborclient/sdk`. The host installs the shared React instance before `activate(hc)` runs. See [React](/api/react).

## Build with `pnpm`

Install dependencies once from your plugin folder:

```bash
cd request-logger
pnpm install
```

Build the plugin code whenever `src/` changes:

```bash
pnpm build
```

That command writes the files HarborClient loads from `dist/`. A renderer-only plugin usually needs `dist/renderer.js`. A plugin with background logic also needs `dist/main.js` and a matching `"main"` field in `manifest.json`.

During development, run the watch script in your plugin checkout:

```bash
pnpm dev
```

When the plugin is loaded unpacked, HarborClient watches the built entry files referenced by the manifest. Rebuilding `dist/renderer.js` or `dist/main.js` triggers a plugin reload. See [Dev workflow](/dev-workflow) for the full hot-reload loop.

## Main entry

Only add a main entry when the plugin needs HTTP hooks, custom IPC handlers, script orchestration, or other background work. Main entries run in the SES utilityProcess; keep React UI code in the renderer entry.

Add the built file to `manifest.json`:

```json
{
  "renderer": "dist/renderer.js",
  "main": "dist/main.js",
  "permissions": ["ui", "http", "ipc"]
}
```

Then include `build:main` in the main build command:

```json
{
  "scripts": {
    "build": "pnpm build:renderer && pnpm build:main",
    "build:renderer": "esbuild src/renderer.tsx --bundle --outfile=dist/renderer.js --format=esm --jsx=automatic --jsx-import-source=@harborclient/sdk --external:react --external:react-dom",
    "build:main": "esbuild src/main.ts --bundle --outfile=dist/main.js --format=esm --platform=neutral"
  }
}
```

Main and renderer entries both export `activate(hc)`. Use renderer code for contributed panels, tabs, and other UI. Use main code for long-lived background registrations such as `hc.http.onBeforeSend`.

## Serve or package the plugin

For local development, serve the plugin directly from its git checkout as an unpacked plugin. Build once so `dist/` exists, then choose **File → Plugins → Install → Load unpacked…** and select the plugin project folder containing `manifest.json`. You can also register the path when launching HarborClient from the app checkout:

```bash
HARBOR_PLUGINS_DEV=~/projects/request-logger pnpm dev
```

For distribution, create a ZIP archive and use the `.hcp` extension:

```bash
cd request-logger
pnpm pack:hcp
```

The `pack:hcp` script shown above runs `pnpm build` and writes `../request-logger.hcp` with `manifest.json`, `README.md`, and `dist/`. You can also build `request-logger.zip` and rename it to `request-logger.hcp`; HarborClient treats both the same way at install time as long as the contents are a valid plugin layout.

Before sharing a packaged plugin, sign the built plugin directory with an Ed25519 key so users can verify file integrity. See [Signing](/signing) for key generation, CLI usage, and the `signature.json` format.

See [Package layout](/manifest#package-layout) for the expected directory structure and [Dev workflow](/dev-workflow) for iterative development with unpacked loading.
