# Plugin development

HarborClient plugins extend the app with installable packages: custom settings panels, sidebar views, request tabs, appearance themes, **File → Import** handlers, HTTP hooks, and persistent storage. Each plugin ships as a **HarborClient plugin** file (`.hcp`) containing a `manifest.json` and bundled JavaScript. A `.hcp` file is a normal ZIP archive — the extension is a naming convention only, not a separate container format. Plugins use the same `hc` namespace as [request scripts](https://harborclient.com/request-scripts), but with a broader API suited to long-lived extensions.

**Themes** are plugins too: declare `contributes.themes`, register with `hc.themes.register` (or point the contribution at a Theme Designer export via `"import": "exported.json"` with no JavaScript entry), and include `"categories": ["themes"]` when the package should appear under **File → Themes** rather than **File → Plugins**.

To install or manage plugins in the app, see [Plugins](https://harborclient.com/plugins) (**File → Plugins**) or browse the [plugin marketplace](https://harborclient.com/plugins). For theme packages, see [Themes](https://harborclient.com/themes) (**File → Themes**). This guide covers package layout, the manifest, APIs, examples, and the development workflow.

## Guide

- [Install](/install) — add `@harborclient/sdk` to your plugin project
- [Quick start](/usage) — minimal renderer and main entry examples
- [Package layout](/package-layout) — directory structure for a `.hcp` package
- [Manifest](/manifest) — `manifest.json` fields, metadata, and contribution types
- [Permissions](/permissions) — capability model and install-time grants
- [Architecture](/architecture) — renderer vs main runtimes and plugin lifecycle
- [Building](/building) — bundling and packaging as `.hcp`
- [Dev workflow](/dev-workflow) — unpacked loading, hot reload, and startup options
- [Renderer API](/renderer-overview) — `PluginContext`, React/JSX, and host integration
- [UI contributions](/renderer-ui) — settings panels, tabs, menus, Action menu actions, and toolbar actions
- [Themes and storage](/renderer-data) — themes, commands, storage, and filesystem
- [Main API](/main-api) — HTTP hooks and IPC in the SES utilityProcess
- [Snippets](/snippets) — types and import syntax for request script snippet files
- [Components](/storybook/index.html) — interactive component explorer (Storybook)
- [Examples](/examples/) — request logger, audit tab, Solarized theme, and import handler
- [Marketplace](/marketplace) — publish to the HarborClient plugin catalog
- [Performance](/performance) — IPC and rendering best practices
- [Plugins vs scripts](/vs-request-scripts) — how plugins differ from request scripts
