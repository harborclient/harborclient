Register handlers for **File → Import** so plugins can participate in the unified import flow instead of adding separate File menu items.

Requires the `ui` permission. Call `registerImportHandler(hc, extensions, handler)` or `hc.imports.registerHandler(extensions, handler)` — registration disposables are tracked automatically.

Built-in HarborClient formats (HarborClient exports, Postman, Bruno, HAR, OpenCollection, and OpenAPI) are detected first. Plugin handlers run only when the selected file is not recognized as a built-in format and its extension matches a registered handler.

Handlers run in registration order. The first handler whose `canImport` returns true receives the file. Throw an `Error` from `import` to surface a blocking failure in the host.

### Common patterns

**Direct import** — parse `file.contents` inside `import` and create HarborClient data immediately (for example with `hc.host.createCollection`). Use when the user does not need a preview step.

**Preview UI** — stash the selected `ImportFile` in plugin state, then open a registered main view with `hc.commands.execute('harborclient:openMainView', hc.pluginId, viewId)`. The preview component reads the stashed file, lets the user confirm selections, and calls host APIs when ready.

See the [Import handler example](/examples/import-handler) for a complete walkthrough. OpenAPI 3.x and OpenCollection import are built into HarborClient (**File → Import**); use import handlers for additional custom formats.

### registerImportHandler(hc, extensions, handler)

**Signature:** `(hc: PluginContext, extensions: string | string[], handler: ImportHandler) => Disposable`

Convenience wrapper around `hc.imports.registerHandler`.

```typescript
import { registerImportHandler } from '@harborclient/sdk';

registerImportHandler(hc, '.json', {
  canImport: (file) => {
    try {
      const parsed = JSON.parse(file.contents) as { bundleFormat?: unknown; version?: unknown };
      return parsed.bundleFormat === 'request-bundle' && parsed.version === 1;
    } catch {
      return false;
    }
  },
  import: async (file) => {
    // Direct import: create a collection immediately, or open a preview main view.
    await hc.host.createCollection({
      name: 'Imported bundle',
      requests: [{ name: 'Example', method: 'GET', url: 'https://example.com' }]
    });
  }
});
```
