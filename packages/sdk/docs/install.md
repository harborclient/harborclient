# Install

```bash
pnpm add -D @harborclient/sdk
```

Requires HarborClient **>=1.9.0** when using `hc.pluginId`.

## Skeleton plugin

A skeleton plugin is available at [harborclient/plugin-skeleton](https://github.com/harborclient/plugin-skeleton). You can clone it and get started quickly.

```bash
npx @harborclient/plugin-skeleton@latest
```

This will create a new directory with a basic plugin structure. You can then install dependencies and start developing your plugin.

```bash
cd my-plugin
pnpm install
```

## Development

You can start the plugin development server with:

```bash
pnpm dev
```

This will start the plugin development server at `http://localhost:5173`.

## Building

You can build the plugin with:

```bash
pnpm build
```
