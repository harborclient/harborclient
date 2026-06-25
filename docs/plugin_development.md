# Plugin development

HarborClient plugins extend the app with installable packages: custom settings panels, sidebar views, request tabs, appearance themes, HTTP hooks, and persistent storage. Each plugin ships as a **HarborClient plugin** file (`.hcp`) containing a `manifest.json` and bundled JavaScript. Plugins use the same `hc` namespace as [request scripts](/request-scripts), but with a broader API suited to long-lived extensions.

To install or manage plugins in the app, see [Settings → Plugins](/settings#plugins) or browse the [plugin marketplace](/plugins).

**Plugin developer documentation** — package layout, manifest reference, renderer and main APIs, examples, dev workflow, and marketplace publishing — lives in the [@harborclient/plugin-api](https://harborclient.github.io/plugin-api/) docs site. Start with the [introduction](https://harborclient.github.io/plugin-api/) and follow the sidebar for the full guide.

Install the SDK in your plugin project:

```bash
pnpm add -D @harborclient/plugin-api
```
