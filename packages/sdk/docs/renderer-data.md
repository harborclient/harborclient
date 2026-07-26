# Themes and storage

Theme packages are plugins. Ship the same `.hcp` layout, require the `ui` permission, declare slots in `contributes.themes`, and set `"categories": ["themes"]` when the package should appear under **File → Themes**. Users pick an active theme from **View → Theme** or **Settings → General → Appearance**.

See [Theme plugins](/manifest#theme-plugins) for manifest fields and [Marketplace → Theme listings](/marketplace#theme-listings) for catalog publishing.

## hc.themes

Custom appearance themes extend the built-in **Light**, **Dark**, **System**, and **High contrast** options in **Settings → General**. Plugin themes appear in the same dropdown once registered.

HarborClient styles the app with `--mac-*` CSS custom properties defined in `src/renderer/src/styles.css`. When a plugin theme is active, the host sets `data-theme="plugin-<pluginId>-<themeId>"` on `<html>` and applies your token overrides or injected stylesheet. Built-in light/dark/system behavior is unchanged when a builtin theme is selected.

Themes can be registered two ways:

1. **JavaScript** — call `registerTheme(hc, theme)` or `hc.themes.register(theme)` from `activate()` (documented below).
2. **JSON import** — point the manifest contribution at a Theme Designer export file (see [JSON theme import](#json-theme-import)). No `activate()` call is required for those entries.

Requires the `ui` permission. For JavaScript registration, call `registerTheme(hc, theme)` or `hc.themes.register(theme)` from `activate()` — registration disposables are tracked automatically.

### JSON theme import

Declare an `import` path on the contribution to ship a palette without JavaScript:

```json
{
  "contributes": {
    "themes": [
      {
        "id": "solarized",
        "title": "Solarized Dark",
        "type": "dark",
        "import": "exported.json"
      }
    ]
  }
}
```

The file must be a `harborclientExport: "theme"` envelope — the same shape as **File → Themes → Designer** export:

```json
{
  "harborclientVersion": 1,
  "harborclientExport": "theme",
  "title": "Solarized Dark",
  "type": "dark",
  "theme": {
    "surface": "#002b36",
    "accent": "#268bd2"
  },
  "stylesheet": "styles.css"
}
```

| Field                 | Description                                                                  |
| --------------------- | ---------------------------------------------------------------------------- |
| `harborclientVersion` | Always `1`                                                                   |
| `harborclientExport`  | Always `"theme"`                                                             |
| `theme`               | Token overrides without the `--mac-` prefix                                  |
| `title` / `type`      | Present in the export; manifest `id` / `title` / `type` remain authoritative |
| `stylesheet`          | Optional plugin-relative CSS filename, or inlined CSS after first read       |

On first read, if `stylesheet` points at an existing CSS file inside the plugin directory, HarborClient inlines the CSS text into the JSON on disk. Later reads treat the value as already-inlined CSS (idempotent). Theme-only packages can omit `renderer` and `main` entirely.

See the [Solarized theme](/examples/solarized-theme#json-import-no-javascript) example and [Theme plugins](/manifest#theme-plugins).

### registerTheme(hc, theme)

**Signature:** `(hc: PluginContext, theme: ThemeContribution) => Disposable`

Convenience wrapper around `hc.themes.register`. Prefer this for single-theme plugins.

```typescript
import { registerTheme } from '@harborclient/sdk';

registerTheme(hc, {
  id: 'solarized',
  title: 'Solarized Dark',
  type: 'dark',
  colors: { surface: '#002b36' }
});
```

Use `defineTheme(theme)` when you want to define the theme object in a separate module with full `ThemeContribution` typing.

### hc.themes.register(theme)

**Signature:** `(theme: ThemeContribution) => Disposable`

**Manifest:** `contributes.themes`

| Parameter    | Type                                        | Description                                                         |
| ------------ | ------------------------------------------- | ------------------------------------------------------------------- |
| `id`         | `string`                                    | Theme id unique within your plugin                                  |
| `title`      | `string`                                    | Label in the appearance dropdown                                    |
| `type`       | `'light' \| 'dark'`                         | Sets `color-scheme` and Electron native chrome base                 |
| `colors`     | `Partial<Record<ThemeColorToken, string>>`  | Optional color token overrides                                      |
| `metrics`    | `Partial<Record<ThemeMetricToken, string>>` | Optional typography/geometry overrides (CSS strings such as `14px`) |
| `stylesheet` | `string`                                    | Optional plugin-relative CSS file for complex themes                |

Provide `colors`, `metrics`, a `stylesheet`, or a combination. Use `colors` / `metrics` for token swaps; use `stylesheet` when you need selectors beyond `:root` (for example plugin-specific tweaks under `[data-theme='plugin-…']`).

```typescript
hc.themes.register({
  id: 'solarized',
  title: 'Solarized Dark',
  type: 'dark',
  colors: {
    surface: '#002b36',
    sidebar: '#073642',
    control: '#073642',
    text: '#839496',
    'text-secondary': '#93a1a1',
    accent: '#268bd2',
    selection: 'rgba(38, 139, 210, 0.25)'
  },
  metrics: {
    'layout-font-size': '14px',
    'scrollbar-width': '10px'
  }
});
```

When the user selects your theme, the persisted value is `plugin:<pluginId>:<themeId>`. If the plugin is disabled or uninstalled while its theme is active, HarborClient falls back to **System**.

### hc.themes.getActive()

**Signature:** `() => Promise<ActiveTheme>`

Returns the currently active theme — either a built-in id or a plugin theme reference.

```typescript
const active = await hc.themes.getActive();
if (active.source === 'plugin') {
  console.log(active.pluginId, active.themeId);
}
```

### hc.themes.onDidChange(listener)

**Signature:** `(listener: (theme: ActiveTheme) => void) => Disposable`

Fires when the user changes the appearance theme in Settings or when the host resets theme after plugin deactivation.

```typescript
hc.themes.onDidChange((theme) => {
  if (theme.source === 'plugin' && theme.themeId === 'solarized') {
    hc.ui.showToast('Solarized theme active');
  }
});
```

### Theme color tokens

Override any of these keys in `colors`. Each maps to `--mac-<token>` on the document root.

| Token                                                  | Used for                                                 |
| ------------------------------------------------------ | -------------------------------------------------------- |
| `surface`                                              | Main content background                                  |
| `sidebar`                                              | Left sidebar background                                  |
| `sidebar-toolbar`                                      | Sidebar/footer toolbar strip background                  |
| `sidebar-section`                                      | Sidebar section headers                                  |
| `sidebar-section-text`                                 | Sidebar section header labels and chevrons               |
| `footer`                                               | Footer status bar background                             |
| `footer-text`                                          | Footer primary text                                      |
| `footer-muted`                                         | Footer de-emphasized text                                |
| `footer-icon-active`                                   | Active footer icon toggle color                          |
| `toolbar-action-active`                                | Pressed sidebar toolbar action icon color                |
| `breadcrumb-background`                                | Request editor breadcrumb bar track                      |
| `breadcrumb-segment`                                   | Breadcrumb chevron segment fill                          |
| `git-staged`                                           | Git-backed request names staged for commit               |
| `git-uncommitted`                                      | Git-backed request names with tracked unstaged changes   |
| `git-unstaged`                                         | Git-backed request names not yet added to the repository |
| `control`                                              | Panels, inputs, footer bar                               |
| `field`                                                | Input field fill                                         |
| `separator`                                            | Borders and dividers                                     |
| `text`                                                 | Primary text                                             |
| `text-secondary`                                       | Secondary labels                                         |
| `muted`                                                | De-emphasized text                                       |
| `accent`                                               | Links, focus rings, primary actions                      |
| `selection`                                            | Selected row / highlight fill                            |
| `tab-underline`                                        | Active request tab underline                             |
| `resize-handle`                                        | Borders, resize grips, high-contrast chrome accents      |
| `variable-token`                                       | `{{variable}}` syntax highlight in editors               |
| `danger`, `danger-light`, `warning`, `success`, `info` | Status colors                                            |
| `method-get`, `method-post`, …                         | HTTP method badge colors                                 |

See the [Solarized theme example](/examples/solarized-theme) for a complete theme plugin.

## hc.commands

Command handlers tie together menus, toolbar actions, and context menu items.

### hc.commands.register(id, handler)

**Signature:** `(id: string, handler: (...args: unknown[]) => void | Promise<void>) => Disposable`

**Manifest:** matching `contributes.commands` entry

Registers a command handler. The `id` must match a command declared in the manifest and referenced by menu, toolbar, or context menu contributions.

### hc.commands.execute(id, ...args)

**Signature:** `(id: string, ...args: unknown[]) => Promise<void>`

Runs a registered command programmatically — for example to open a main view from another part of your plugin.

```typescript
hc.commands.register('myPlugin.openDashboard', () => {
  void hc.commands.execute('myPlugin.navigateToView', 'myPlugin.view');
});
```

## hc.storage

Plugin-scoped persistent storage. Keys are namespaced by plugin `id` in the main process. Requires the `storage` permission.

### hc.storage.get(key)

**Signature:** `<T>(key: string) => Promise<T | undefined>`

Returns the stored value, or `undefined` if the key has never been set.

```typescript
const enabled = await hc.storage.get<boolean>('enabled');
```

### hc.storage.set(key, value)

**Signature:** `<T>(key: string, value: T) => Promise<void>`

Persists a JSON-serializable value.

```typescript
await hc.storage.set('enabled', true);
```

### Storage-backed store (cross-webview sync)

Separate plugin webviews do not share memory. When one surface writes
`hc.storage` and another needs to react (for example a sidebar and a modal
overlay), reload from storage on focus/visibility instead of duplicating
read/diff/notify logic in every plugin.

`@harborclient/sdk/store` provides:

- **`createStorageStore<T>({ storage, key, parse, equals?, keepCurrentWhenMissing? })`**
  — returns `{ subscribe, getSnapshot, useValue, reloadFromStorage, set }`.
  Hydrates from storage asynchronously on creation; synchronous `getSnapshot()`
  may show `parse(undefined)` until hydration completes. `parse` validates raw
  storage into a typed snapshot; `set` updates memory and persists (write-through).
  Default equality uses `JSON.stringify`; pass a custom `equals` for cheaper
  comparisons. Set `keepCurrentWhenMissing: true` when an absent storage key should
  not reset in-memory state. Await `reloadFromStorage()` when you need the persisted
  value before a synchronous read.
- **`syncOnWindowFocus(stores, { intervalMs? })`** — wires `focus`,
  `visibilitychange`, and optional polling to `reloadFromStorage` on one or more
  stores. Returns a `Disposable`; dispose from `deactivate()` or a React effect cleanup.

```typescript
import type { Disposable, PluginContext } from '@harborclient/sdk';
import { createStorageStore, syncOnWindowFocus } from '@harborclient/sdk/store';

let schemasStore: ReturnType<typeof createStorageStore<unknown[]>>;
let focusSync: Disposable | undefined;

export function activate(hc: PluginContext) {
  schemasStore = createStorageStore({
    storage: hc.storage,
    key: 'schemas',
    parse: (raw) => (Array.isArray(raw) ? raw : [])
  });
  focusSync = syncOnWindowFocus(schemasStore);
}

export function deactivate() {
  focusSync?.dispose();
}

// In a component:
const schemas = schemasStore.useValue();
await schemasStore.set([...schemas, newEntry]);
```

Use **`createExternalStore`** from the same module for in-webview-only state
that does not need persistence.

## hc.database

Plugin-scoped SQLite database. Each plugin id gets its own file under HarborClient userData (`plugin-databases/{pluginId}.sqlite`). Requires the `database` permission.

Use `hc.database` when you need indexed queries, relational data, or large structured stores. Keep small settings in `hc.storage`; the two APIs share no tables and neither can access HarborClient collections or other plugins' data.

`get`, `all`, and `run` accept **single-statement** parameterized SQL (`?` placeholders). Use `exec` for migration scripts (multi-statement DDL). Use `transaction` for atomic multi-step writes.

### hc.database.get(sql, params?)

**Signature:** `<T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T | undefined>`

Returns the first row, or `undefined` when no row matches.

```typescript
const row = await hc.database.get<{ count: number }>(
  'SELECT COUNT(*) AS count FROM events WHERE request_id = ?',
  [requestId]
);
```

### hc.database.all(sql, params?)

**Signature:** `<T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>`

Returns all matching rows.

### hc.database.run(sql, params?)

**Signature:** `(sql: string, params?: unknown[]) => Promise<PluginRunResult>`

Runs an `INSERT`, `UPDATE`, or `DELETE` statement. Returns `{ changes, lastInsertRowid }`.

### hc.database.exec(sql)

**Signature:** `(sql: string) => Promise<void>`

Executes a multi-statement SQL script (typically migrations). Rejects scripts containing `ATTACH`, `DETACH`, or `load_extension`.

```typescript
await hc.database.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    status INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_events_request_id ON events(request_id);
`);
```

### hc.database.transaction(fn)

**Signature:** `<T>(fn: (tx: PluginDatabaseTx) => Promise<T>) => Promise<T>`

Runs `fn` inside an exclusive transaction. The `tx` object exposes `get`, `all`, and `run` bound to the same transaction.

```typescript
await hc.database.transaction(async (tx) => {
  await tx.run('INSERT INTO outbox (payload) VALUES (?)', [JSON.stringify(body)]);
  await tx.run('UPDATE counters SET value = value + 1 WHERE name = ?', ['sent']);
});
```

Plugin database files are included in HarborClient `.hcb` backups and removed when the plugin is uninstalled.

## hc.fs

Plugin-scoped filesystem access backed by main-process permission checks and a per-plugin path allowlist. Requires `filesystem:pick` for open/save dialogs, `filesystem:read` for `readFile`, and `filesystem:write` for `writeFile`. User-selected paths from pick/save dialogs are added to the allowlist automatically; the plugin package directory is allowlisted on load. User-granted paths persist across app restarts and are restored when the plugin loads again.

### hc.fs.pickFile(options?)

**Signature:** `(options?: PluginFsPickFileOptions) => Promise<string[]>`

Opens a native file picker. Returns absolute paths for the selected files, or an empty array when the dialog is canceled. Requires the `filesystem:pick` permission.

```typescript
const paths = await hc.fs.pickFile({
  title: 'Choose a schema',
  filters: [{ name: 'JSON', extensions: ['json'] }]
});
```

### hc.fs.pickDirectory(defaultPath?)

**Signature:** `(defaultPath?: string) => Promise<string | null>`

Opens a native directory picker. Returns the selected directory path, or `null` when canceled. Requires the `filesystem:pick` permission.

### hc.fs.saveFile(content, options?)

**Signature:** `(content: string, options?: PluginFsSaveFileOptions) => Promise<string | null>`

Opens a native save dialog and writes `content` to the chosen path. Returns the saved path, or `null` when canceled. Requires the `filesystem:pick` and `filesystem:write` permissions.

### hc.fs.readFile(path)

**Signature:** `(path: string) => Promise<string>`

Reads a UTF-8 text file from an allowlisted path. Requires the `filesystem:read` permission.

### hc.fs.writeFile(path, content)

**Signature:** `(path: string, content: string) => Promise<void>`

Writes UTF-8 text to an allowlisted path. Requires the `filesystem:write` permission.

## hc.http

Renderer-side HTTP lifecycle events. See [Renderer API](/renderer-overview) for full documentation.

Requires the `http` permission. Use `hc.http.onAfterSend` when you only need to react to completed sends in the UI — no main entry or polling required.

## hc.ipc

Renderer-side RPC into the plugin main entry. See [Renderer API](/renderer-overview).

Requires the `ipc` permission. Call `hc.ipc.invoke(channel, ...args)` instead of `window.api.invokePluginMain`.

## hc.host

Typed wrappers for built-in request editor commands. See [Renderer API](/renderer-overview).

Requires the `ui` permission. Use `hc.host.openRequestDraft`,
`hc.host.applyRequestDraft`, `hc.host.loadRequest`, `hc.host.sendRequest`,
`hc.host.createCollection`, and `hc.host.openImageView` instead of
`hc.commands.execute('harborclient:…')`.

### Request creation and update choices

Pick the host API based on the user-facing result you want:

| Goal                                           | API                         | Result                                                                   |
| ---------------------------------------------- | --------------------------- | ------------------------------------------------------------------------ |
| Create a new editable request tab              | `hc.host.openRequestDraft`  | Opens an unsaved tab seeded with the supplied request fields             |
| Update the active request tab in place         | `hc.host.applyRequestDraft` | Replaces supplied fields on the active draft and marks the tab dirty     |
| Open an existing saved request by database id  | `hc.host.loadRequest`       | Focuses an already-open tab or loads the saved request from a collection |
| Bulk-create saved requests in a new collection | `hc.host.createCollection`  | Persists a collection, optional folders, and saved requests              |
| Open an image in a dedicated viewer tab        | `hc.host.openImageView`     | Opens or focuses a session-only image-view tab for a path, URL, or bytes |

Use `openRequestDraft` for history/recent-request style workflows where the
plugin should not disturb the current tab. Use `applyRequestDraft` when the user
is intentionally transforming the active request, such as a cURL/import preview
tab with an **Update** button. Use `createCollection` for importers that create
saved requests rather than editing the current tab. Use `openImageView` for
screenshots, logos, generated charts, or import previews that belong in a
dedicated image tab.

### hc.host.openRequestDraft(payload)

**Signature:** `(payload: OpenRequestDraftPayload) => Promise<void>`

Opens a new unsaved request tab seeded with request metadata. Omitted fields use
HarborClient defaults (`GET`, no body, empty headers/params). `headers` is a
flat map; `params` is an array of enabled query parameter rows.

```typescript
await hc.host.openRequestDraft({
  name: 'Create pet',
  method: 'POST',
  url: 'https://api.example.com/pets',
  headers: { 'Content-Type': 'application/json' },
  params: [{ key: 'trace', value: 'true' }],
  body: JSON.stringify({ name: 'Fluffy' }),
  bodyType: 'json'
});
```

### hc.host.applyRequestDraft(payload)

**Signature:** `(payload: ApplyRequestDraftPayload) => Promise<void>`

Updates the active request editor tab in place. Provided fields replace the
corresponding draft values; when `headers` or `params` are supplied, those
tables are replaced entirely. The tab becomes dirty, so the user still decides
whether to save the changed request to its collection.

```typescript
function parseExternalFormat(source: string): ApplyRequestDraftPayload {
  return {
    method: 'PUT',
    url: 'https://api.example.com/pets/123',
    headers: { 'Content-Type': 'application/json' },
    body: source,
    bodyType: 'json'
  };
}

await hc.host.applyRequestDraft(parseExternalFormat(editorText));
hc.ui.showToast('Request updated');
```

`applyRequestDraft` throws when there is no active request tab or when a field is
invalid. Show parse/update failures inline in your plugin UI when the user needs
to fix input.

### hc.host.createCollection(payload)

**Signature:** `(payload: CreateCollectionPayload) => Promise<CreateCollectionResult>`

Bulk-creates a collection with folders and saved requests. Requests sharing the same `folder` string are grouped into one folder; requests without `folder` are created at the collection root.

```typescript
const { collectionId } = await hc.host.createCollection({
  name: 'Petstore API',
  requests: [
    {
      name: 'List pets',
      method: 'GET',
      url: 'https://api.example.com/pets',
      folder: 'pets'
    },
    {
      name: 'Create pet',
      method: 'POST',
      url: 'https://api.example.com/pets',
      folder: 'pets',
      body: '{"name":"Fluffy"}',
      bodyType: 'json'
    }
  ]
});
```

### hc.host.openImageView(payload)

**Signature:** `(payload: OpenImageViewPayload) => Promise<void>`

Opens or focuses an image-view page tab. Use this to display screenshots, logos,
generated charts, or import previews in a dedicated tab with **Copy location**
and **Download** actions. Prefer this typed API over
`hc.commands.execute('harborclient:openImageView', payload)`.

See also [Renderer API → hc.host](/renderer-overview#hchost).

**Payload rules**

- Provide exactly one source: `path`, `url`, `dataUrl`, or `base64` with
  `contentType`.
- `fileName` is optional for `path` and `url` (derived from the basename or last
  URL path segment). It is required for inline `dataUrl` and `base64` payloads.
- Inline `dataUrl` / `base64` payloads are capped by the same IPC body-size limit
  as large request bodies.

**Tab behavior**

| Aspect         | Behavior                                                                      |
| -------------- | ----------------------------------------------------------------------------- |
| Tab label      | Shortened filename (middle ellipsis, extension preserved)                     |
| Page header    | Full filename                                                                 |
| Deduping       | Reopening the same source focuses the existing tab                            |
| Persistence    | Session-only — image tabs are not restored after restart                      |
| In-tab actions | **Copy location** (path, URL, or data URL) and **Download** via a save dialog |

```typescript
// From a menu action or command handler
await hc.host.openImageView({
  url: 'https://harborclient.com/images/logo.png'
});

// After the user picks a file with hc.fs.pickFile
await hc.host.openImageView({ path: selectedPath });

// Inline bytes from a plugin-generated PNG
await hc.host.openImageView({
  fileName: 'preview.png',
  base64: pngBase64,
  contentType: 'image/png'
});
```

## Global variables

HarborClient stores app-wide variables in **Settings → Globals**. They use the same `Variable` shape as collection and environment variables (`key`, `value`, `defaultValue`, `share`) and participate in `{{key}}` substitution with the **lowest precedence** in the static chain:

**globals → collection → environment**

Request scripts can mutate globals with `hc.globals.get` / `hc.globals.set`; values persist after the send completes. See [Request scripts — hc.globals](https://harborclient.com/request-scripts#hcglobals).

### Reading globals from plugins

Request tab components receive the merged runtime map on `RequestTabContext.variables`. Global values are included automatically; collection and environment variables override globals when they define the same key:

```typescript
function AuditTab({ context }: { context: RequestTabContext }) {
  const baseUrl = context.variables.baseUrl;
  const token = context.variables.token;
  // ...
}
```

This snapshot reflects the editor state before send. It does not include ephemeral values from `hc.request.variables.set` during an in-flight send.

### Updating globals from plugins

Replace all global variables with a new list via the built-in host command (requires the `ui` permission):

```typescript
await hc.commands.execute('harborclient:updateGlobalVariables', [
  { key: 'baseUrl', value: 'https://api.example.com', defaultValue: '', share: true },
  { key: 'apiKey', value: '', defaultValue: 'dev-key', share: false }
]);
```

Each row uses `PluginVariableInput`: `key`, `value`, optional `defaultValue`, optional `share`.

To create or update **environment** variables instead, use `hc.host.createEnvironmentWithVariables` and `hc.host.updateEnvironmentVariables`.

## hc.imports

Register handlers for **File → Import** so plugins can participate in the unified import flow instead of adding separate File menu items.

Requires the `ui` permission. Call `registerImportHandler(hc, extensions, handler)` or `hc.imports.registerHandler(extensions, handler)` — registration disposables are tracked automatically.

Built-in HarborClient formats (Postman, Bruno, HAR, and native exports) are detected first. Plugin handlers run only when the selected file is not recognized as a built-in format and its extension matches a registered handler.

Handlers run in registration order. The first handler whose `canImport` returns true receives the file. Throw an `Error` from `import` to surface a blocking failure in the host.

### Common patterns

**Direct import** — parse `file.contents` inside `import` and create HarborClient data immediately (for example with `hc.host.createCollection`). Use when the user does not need a preview step.

**Preview UI** — stash the selected `ImportFile` in plugin state, then open a registered main view with `hc.commands.execute('harborclient:openMainView', hc.pluginId, viewId)`. The preview component reads the stashed file, lets the user confirm selections, and calls host APIs when ready.

See the [Import handler example](/examples/import-handler) for a complete walkthrough. OpenAPI 3.x import is built into HarborClient (**File → Import**); use import handlers for additional custom formats.

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

### hc.imports.registerHandler(extensions, handler)

**Signature:** `(extensions: string | string[], handler: ImportHandler) => Disposable`

| Callback    | Type                                                | Description                                         |
| ----------- | --------------------------------------------------- | --------------------------------------------------- |
| `canImport` | `(file: ImportFile) => boolean \| Promise<boolean>` | Returns whether this handler should import the file |
| `import`    | `(file: ImportFile) => void \| Promise<void>`       | Performs the import workflow                        |

`ImportFile` includes `name`, `path`, `extension` (dot-prefixed, lowercase), and UTF-8 `contents`.

Extensions may be passed with or without a leading dot (`json` and `.json` are equivalent). Register multiple extensions in one call: `['.json', '.yaml', '.yml']`.

## hc.mcp

Register remote MCP client servers so Harbor's chat agent can discover and call tools from external MCP endpoints over Streamable HTTP or legacy SSE.

Requires the `mcp` permission. Registrations are **activation-scoped**: Harbor connects while the plugin is enabled and removes them when you dispose the returned handle or the plugin unloads. Plugin-owned servers appear as **read-only** rows in **Settings → AI & MCP** with plugin attribution; they are not copied into user MCP settings.

### hc.mcp.registerServer(config)

**Signature:** `(config: PluginMcpServerConfig) => Disposable`

| Field       | Type                 | Description                                                                 |
| ----------- | -------------------- | --------------------------------------------------------------------------- |
| `name`      | `string`             | Display name in Settings → AI & MCP                                         |
| `serverURL` | `string`             | Absolute HTTP or HTTPS MCP endpoint URL                                     |
| `enabled`   | `boolean` (optional) | When false, Harbor skips connecting. Defaults to `true`                     |
| `headers`   | `PluginMcpHeader[]`  | Optional HTTP headers sent with MCP client requests                         |
| `icon`      | `string` (optional)  | Optional square icon as a `data:image/...;base64,...` URI for settings rows |

```typescript
hc.mcp.registerServer({
  name: 'WordPress',
  icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  serverURL: 'https://public-api.wordpress.com/wpcom/v2/mcp/v1',
  enabled: true,
  headers: [{ key: 'Authorization', value: 'Bearer token' }]
});
```

Discovered tools are prefixed with `mcp__` in the chat agent tool list, using the same naming scheme as user-configured MCP client servers.

## Not extensible

These built-in surfaces are not open to plugin contributions:

- **Open request tab strip** — tabs for unsaved/saved requests in the editor workspace.
- **AI sidebar** — the built-in assistant panel.
- **Native window chrome** — title bar and window controls (menu contributions use the application menu only).
