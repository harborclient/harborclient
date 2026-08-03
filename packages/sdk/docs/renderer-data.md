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

<HcMethod name="themes.register" :level="3" />

<HcMethod name="themes.getActive" :level="3" />

<HcMethod name="themes.onDidChange" :level="3" />

### Theme color tokens

Override any of these keys in `colors`. Each maps to `--mac-<token>` on the document root.

| Token                                                  | Used for                                                 |
| ------------------------------------------------------ | -------------------------------------------------------- |
| `surface`                                              | Main content background                                  |
| `header`                                               | Top header strip (sidebar search + request tab bar)      |
| `page-header`                                          | Page title header background (`PageHeader`)              |
| `page-header-text`                                     | Page title header primary text                           |
| `page-header-muted`                                    | Page title header description and decorative icons       |
| `sidebar`                                              | Left sidebar background                                  |
| `sidebar-toolbar`                                      | Sidebar/footer toolbar strip background                  |
| `sidebar-rail`                                         | Activity rail background                                 |
| `sidebar-rail-active`                                  | Active/hover activity rail section fill                  |
| `sidebar-rail-text`                                    | Activity rail icons and labels                           |
| `sidebar-rail-separator`                               | Activity rail hairline between item groups               |
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
| `resize-separator`                                     | Resizable panel separator track and edge border          |
| `resize-handle`                                        | Resizable panel grip (and high-contrast chrome accents)  |
| `variable-token`                                       | `{{variable}}` syntax highlight in editors               |
| `danger`, `danger-light`, `warning`, `success`, `info` | Status colors                                            |
| `method-get`, `method-post`, …                         | HTTP method badge colors                                 |

See the [Solarized theme example](/examples/solarized-theme) for a complete theme plugin.

## hc.commands

Command handlers tie together menus, toolbar actions, and context menu items.

<HcMethod name="commands.register" :level="3" />

<HcMethod name="commands.execute" :level="3" />

## hc.storage

Plugin-scoped persistent storage. Keys are namespaced by plugin `id` in the main process. Requires the `storage` permission.

<HcMethod name="storage.get" :level="3" />

<HcMethod name="storage.set" :level="3" />

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

<HcMethod name="database.get" :level="3" />

<HcMethod name="database.all" :level="3" />

<HcMethod name="database.run" :level="3" />

<HcMethod name="database.exec" :level="3" />

<HcMethod name="database.transaction" :level="3" />

## hc.fs

Plugin-scoped filesystem access backed by main-process permission checks and a per-plugin path allowlist. Requires `filesystem:pick` for open/save dialogs, `filesystem:read` for `readFile`, and `filesystem:write` for `writeFile` / `writeBytes`. User-selected paths from pick/save dialogs are added to the allowlist automatically; the plugin package directory is allowlisted on load. User-granted paths persist across app restarts and are restored when the plugin loads again.

<HcMethod name="fs.pickFile" :level="3" />

<HcMethod name="fs.pickDirectory" :level="3" />

<HcMethod name="fs.saveFile" :level="3" />

<HcMethod name="fs.readFile" :level="3" />

<HcMethod name="fs.writeFile" :level="3" />

<HcMethod name="fs.writeBytes" :level="3" />

## hc.http

Renderer-side HTTP lifecycle events. See [Renderer API](/renderer-overview) for full documentation.

Requires the `http` permission. Use `hc.http.onAfterSend` when you only need to react to completed sends in the UI — no main entry or polling required.

## hc.ipc

Renderer-side RPC into the plugin main entry. See [Renderer API](/renderer-overview).

Requires the `ipc` permission. Call `hc.ipc.invoke(channel, ...args)` instead of `window.api.invokePluginMain`.

## hc.host

Typed wrappers for built-in request editor commands. See [Renderer API](/renderer-overview).

Requires the `ui` permission. Use `hc.host.openRequestDraft`,
`hc.host.applyRequestDraft`, `hc.host.loadRequest`, `hc.host.send`,
`hc.host.fetch`, `hc.host.createCollection`, library read/write helpers
(`listLibraryTree`, `createFolder`, `createRequest`, …),
`hc.host.onLibraryChanged`, and `hc.host.openImageView` instead of
`hc.commands.execute('harborclient:…')`.

### Request creation and update choices

Pick the host API based on the user-facing result you want:

| Goal                                           | API                         | Result                                                                   |
| ---------------------------------------------- | --------------------------- | ------------------------------------------------------------------------ |
| Create a new editable request tab              | `hc.host.openRequestDraft`  | Opens an unsaved tab seeded with the supplied request fields             |
| Update the active request tab in place         | `hc.host.applyRequestDraft` | Replaces supplied fields on the active draft and marks the tab dirty     |
| Open an existing saved request by database id  | `hc.host.loadRequest`       | Focuses an already-open tab or loads the saved request from a collection |
| Bulk-create saved requests in a new collection | `hc.host.createCollection`  | Persists a collection, optional folders, and saved requests              |
| Mutate library tree entities                   | `hc.host.createFolder` / …  | Create/rename/delete/reorder/move/archive collections, folders, requests |
| List collections / build a custom tree         | `hc.host.listLibraryTree`   | Returns summaries for collections, folders, requests, and documents      |
| React when the library changes                 | `hc.host.onLibraryChanged`  | Coarse invalidation so plugins refetch without polling                   |
| Open an image in a dedicated viewer tab        | `hc.host.openImageView`     | Opens or focuses a session-only image-view tab for a path, URL, or bytes |

Use `openRequestDraft` for history/recent-request style workflows where the
plugin should not disturb the current tab. Use `applyRequestDraft` when the user
is intentionally transforming the active request, such as a cURL/import preview
tab with an **Update** button. Use `createCollection` for importers that create
saved requests rather than editing the current tab. Use `openImageView` for
screenshots, logos, generated charts, or import previews that belong in a
dedicated image tab.

<HcMethod name="host.openRequestDraft" :level="3" />

<HcMethod name="host.applyRequestDraft" :level="3" />

<HcMethod name="host.createCollection" :level="3" />

### Library read APIs

Custom collections sidebars need to **discover** collection ids and subscribe to
changes. These APIs require the `ui` permission and return **serializable
summaries** (ids, names, parent ids, method, sort order, marker) — not full
request bodies or document markdown.

| Method                                | Returns                                                            |
| ------------------------------------- | ------------------------------------------------------------------ |
| `hc.host.listCollections(options?)`   | `CollectionSummary[]`                                              |
| `hc.host.listFolders(collectionId)`   | `FolderSummary[]`                                                  |
| `hc.host.listRequests(collectionId)`  | `SavedRequestSummary[]`                                            |
| `hc.host.listDocuments(collectionId)` | `DocumentSummary[]`                                                |
| `hc.host.listLibraryTree(options?)`   | `LibraryTreeSnapshot` (collections + nested contents + `warnings`) |
| `hc.host.onLibraryChanged(listener)`  | `Disposable`                                                       |

`options.includeArchived` defaults to `false` (active collections only), matching
the built-in Collections tree.

Related existing helpers:

- `hc.host.listCollectionRequests(collectionId, folderId?)` — full saved-request
  rows in sidebar **run order** (includes body/auth). Prefer
  `listRequests` / `listLibraryTree` for tree UI.
- `hc.host.getCollectionMetadata(collectionId)` — full collection settings row
  when you already know the id.

```typescript
async function refreshTree() {
  const tree = await hc.host.listLibraryTree();
  renderSidebar(tree.collections);
}

const stop = hc.host.onLibraryChanged((event) => {
  // event.reason: 'collections' | 'folders' | 'requests' | 'documents'
  // event.collectionId is set for per-collection reasons
  void refreshTree();
});

await refreshTree();

// Later, when the panel deactivates:
stop.dispose();
```

Granular lists are available when a full tree fetch is too heavy:

```typescript
const collections = await hc.host.listCollections();
const folders = await hc.host.listFolders(collections[0].id);
const requests = await hc.host.listRequests(collections[0].id);
const documents = await hc.host.listDocuments(collections[0].id);
```

### Workflow CRUD

Local workflow registry APIs require the `ui` permission. Destructive methods
are silent — confirm with `hc.ui` modals before calling `deleteWorkflow`.

| Method                                     | Returns                |
| ------------------------------------------ | ---------------------- |
| `hc.host.listWorkflows()`                  | `HostWorkflow[]`       |
| `hc.host.getWorkflow(workflowId)`          | `HostWorkflow \| null` |
| `hc.host.createWorkflow(input)`            | `HostWorkflow`         |
| `hc.host.updateWorkflow(input)`            | `HostWorkflow`         |
| `hc.host.renameWorkflow(workflowId, name)` | `HostWorkflow`         |
| `hc.host.deleteWorkflow(workflowId)`       | `void`                 |
| `hc.host.onWorkflowsChanged(listener)`     | `Disposable`           |

`updateWorkflow` replaces `actions` and `durationMs` only; name/variables are
preserved. Use `renameWorkflow` to change the display name.

```typescript
const stop = hc.host.onWorkflowsChanged((event) => {
  // event.reason: 'created' | 'updated' | 'renamed' | 'deleted' | 'refreshed'
  void hc.host.listWorkflows().then(renderWorkflowList);
});

const workflows = await hc.host.listWorkflows();
const created = await hc.host.createWorkflow({
  name: 'Smoke path',
  durationMs: 0,
  actions: []
});
await hc.host.renameWorkflow(created.id, 'Smoke path (renamed)');
stop.dispose();
```

### Navigation and open APIs

Replacement sidebars open host editors and modals through typed `hc.host`
methods (all require `ui`). These wrap the same Redux paths as the built-in
tree — they do not show confirmation dialogs.

| Method                                         | Behavior                                                     |
| ---------------------------------------------- | ------------------------------------------------------------ |
| `hc.host.loadRequest(requestId)`               | Opens/focuses the request tab and updates sidebar selection  |
| `hc.host.loadDocument(documentId)`             | Opens/focuses the markdown tab and updates sidebar selection |
| `hc.host.openCollectionSettings(collectionId)` | Opens the collection settings page tab                       |
| `hc.host.openCollectionRunner(collectionId)`   | Opens the collection runner for the whole collection         |
| `hc.host.openShareModal(collectionId)`         | Opens the share-collection modal                             |
| `hc.host.showEntityContextMenu(input)`         | Opens the host-built entity context menu (see below)         |

`loadRequest` / `loadDocument` require the parent collection contents to be
cached (call `listLibraryTree` / expand the collection first), matching
`loadRequest` today.

<HcMethod name="host.showEntityContextMenu" :level="4" />

### Sidebar selection bridge

Plugins that replace the Collections sidebar stay in sync with host
“reveal in sidebar” / breadcrumb / tab focus via a serializable
`SidebarSelection` union:

```typescript
type SidebarSelection =
  | { kind: 'collection'; collectionId: number }
  | { kind: 'folder'; collectionId: number; folderId: number }
  | {
      kind: 'request';
      collectionId: number;
      folderId: number | null;
      requestId: number;
    }
  | {
      kind: 'document';
      collectionId: number;
      folderId: number | null;
      documentId: number;
    };
```

| Method                                        | Returns / effect                                       |
| --------------------------------------------- | ------------------------------------------------------ |
| `hc.host.getSidebarSelection()`               | `SidebarSelection \| null`                             |
| `hc.host.setSidebarSelection(selection)`      | Updates host Redux; opens request/document tabs        |
| `hc.host.onSidebarSelectionChanged(listener)` | `Disposable` — fires on host and plugin-driven changes |

Selection is derived from Redux collection/folder highlight plus the active
request or document tab (not the built-in tree’s local multi-select set).

```typescript
const current = await hc.host.getSidebarSelection();

const stop = hc.host.onSidebarSelectionChanged((selection) => {
  highlightRow(selection);
});

await hc.host.setSidebarSelection({
  kind: 'request',
  collectionId: 1,
  folderId: null,
  requestId: 42
});
```

### Sidebar panel view context

When a `sidebarPanels` or `sidebarRailItems` contribution is mounted (including
`replaces: "collections"` for panels), `HostedSurface` pushes:

```typescript
interface SidebarPanelViewContext {
  sidebarSelection: SidebarSelection | null;
}
```

Read it on mount with `hc.view.getContext()` (same pattern as request-tab
surfaces). Live updates use `onSidebarSelectionChanged`.

`sidebarRailItems` keep the activity rail visible; `sidebarPanels` use the
horizontal switcher and hide the rail.

### Replacement-panel keyboard shortcuts

When a panel with `replaces: "collections"` is registered:

- **Focus collections sidebar** (`focus-first-collection`) reveals the primary
  surface and focuses the plugin webview (not a hidden built-in row).
- **Focus sidebar search** (`focus-sidebar-search`) does the same — plugins own
  internal search UI; the built-in `#sidebar-search` input is not mounted.
- **Focus environments** remains a no-op while the built-in Environments section
  is hidden by a collections replacement.

### Library write APIs

Custom collections sidebars need the same day-to-day mutations as the built-in
tree (create, rename, delete, reorder, move, archive) without accessing Redux.
These APIs require the `ui` permission and wrap the host store thunks used by
the Collections sidebar.

**Destructive methods are silent.** Host methods do **not** show confirmation
dialogs or toasts. Plugins must confirm with `hc.ui` modals (or equivalent)
before calling `delete*`, `setCollectionArchived`, and similar.

Created entities return **summaries** (same shapes as the list APIs) so plugins
can update UI optimistically and reconcile via `onLibraryChanged`.

| Method                                                                       | Returns               |
| ---------------------------------------------------------------------------- | --------------------- |
| `hc.host.updateCollection({ id, name })`                                     | `CollectionSummary`   |
| `hc.host.deleteCollection(collectionId)`                                     | `void`                |
| `hc.host.reorderCollections(orderedIds)`                                     | `void`                |
| `hc.host.setCollectionArchived({ collectionId, archived })`                  | `void`                |
| `hc.host.duplicateCollection(collectionId)`                                  | `CollectionSummary`   |
| `hc.host.createFolder({ collectionId, name, parentFolderId? })`              | `FolderSummary`       |
| `hc.host.renameFolder({ folderId, collectionId, name })`                     | `FolderSummary`       |
| `hc.host.deleteFolder({ folderId, collectionId })`                           | `void`                |
| `hc.host.moveFolder({ collectionId, folderId, parentFolderId, sortOrder? })` | `FolderSummary`       |
| `hc.host.reorderFolders({ collectionId, parentFolderId, orderedFolderIds })` | `void`                |
| `hc.host.createRequest({ collectionId, folderId?, name?, method?, url? })`   | `SavedRequestSummary` |
| `hc.host.deleteRequest(requestId)`                                           | `void`                |
| `hc.host.duplicateRequest(requestId)`                                        | `SavedRequestSummary` |
| `hc.host.moveRequest({ collectionId, requestId, folderId, index? })`         | `void`                |
| `hc.host.reorderRequests({ collectionId, folderId, orderedRequestIds })`     | `void`                |
| `hc.host.createDocument({ collectionId, folderId?, name, content? })`        | `DocumentSummary`     |
| `hc.host.renameDocument({ id, collectionId, name })`                         | `DocumentSummary`     |
| `hc.host.deleteDocument({ id, collectionId })`                               | `void`                |
| `hc.host.moveDocument({ collectionId, documentId, folderId, index? })`       | `void`                |
| `hc.host.reorderDocuments({ collectionId, folderId, orderedDocumentIds })`   | `void`                |
| `hc.host.reorderContainerItems({ collectionId, folderId, items })`           | `void`                |

Bulk create remains available as `hc.host.createCollection(payload)`.

#### Collections

| Method                  | Parameters                                  | Notes                                      |
| ----------------------- | ------------------------------------------- | ------------------------------------------ |
| `updateCollection`      | `id: number`, `name: string`                | Renames only; other settings are preserved |
| `deleteCollection`      | `collectionId: number`                      | Silent; moves to trash when supported      |
| `reorderCollections`    | `orderedIds: number[]`                      | Full top-level collection order            |
| `setCollectionArchived` | `collectionId: number`, `archived: boolean` | Silent                                     |
| `duplicateCollection`   | `collectionId: number`                      | Places the copy below the original         |

#### Folders

| Method           | Parameters                                                         | Notes                          |
| ---------------- | ------------------------------------------------------------------ | ------------------------------ |
| `createFolder`   | `collectionId`, `name`, optional `parentFolderId`                  | Returns created folder summary |
| `renameFolder`   | `folderId`, `collectionId`, `name`                                 |                                |
| `deleteFolder`   | `folderId`, `collectionId`                                         | Deletes subtree; silent        |
| `moveFolder`     | `collectionId`, `folderId`, `parentFolderId`, optional `sortOrder` |                                |
| `reorderFolders` | `collectionId`, `parentFolderId`, `orderedFolderIds`               | Sibling order under one parent |

#### Requests

| Method             | Parameters                                                      | Notes                                                           |
| ------------------ | --------------------------------------------------------------- | --------------------------------------------------------------- |
| `createRequest`    | `collectionId`, optional `folderId` / `name` / `method` / `url` | Defaults: `Untitled Request`, `GET`, empty URL; **opens a tab** |
| `deleteRequest`    | `requestId`                                                     | Silent                                                          |
| `duplicateRequest` | `requestId`                                                     | Opens the copy in a tab                                         |
| `moveRequest`      | `collectionId`, `requestId`, `folderId`, optional `index`       | Omitting `index` appends                                        |
| `reorderRequests`  | `collectionId`, `folderId`, `orderedRequestIds`                 |                                                                 |

#### Documents

| Method             | Parameters                                                 | Notes                    |
| ------------------ | ---------------------------------------------------------- | ------------------------ |
| `createDocument`   | `collectionId`, `name`, optional `folderId` / `content`    | Does **not** open a tab  |
| `renameDocument`   | `id`, `collectionId`, `name`                               | Body unchanged           |
| `deleteDocument`   | `id`, `collectionId`                                       | Silent                   |
| `moveDocument`     | `collectionId`, `documentId`, `folderId`, optional `index` | Omitting `index` appends |
| `reorderDocuments` | `collectionId`, `folderId`, `orderedDocumentIds`           |                          |

#### Mixed containers

| Method                  | Parameters                                          | Notes                                                                   |
| ----------------------- | --------------------------------------------------- | ----------------------------------------------------------------------- |
| `reorderContainerItems` | `collectionId`, `folderId`, `items: { kind, id }[]` | Interleaved request + document order; prefer over separate reorder APIs |

### Reorder / move pattern

Replacement trees commit drag-end or “Move up/down” actions through the host
APIs above, then refresh via `onLibraryChanged` (or an explicit relist). Prefer
`reorderContainerItems` when a folder interleaves requests and documents.

Do **not** expect the host to ship a DnD library into the plugin webview.
Plugins may use `SortableSidebarItem` / `buildReorderMenuGroup` from
`@harborclient/sdk/components` (dnd-kit is an SDK dependency) or implement their
own pointer DnD and call `move*` / `reorder*` on drop.

See the [sidebar replacement tree example](/examples/sidebar-replacement-tree).

```typescript
const { collectionId } = await hc.host.createCollection({
  name: 'Auth API',
  requests: []
});

await hc.host.createFolder({ collectionId, name: 'Auth' });
const folder = await hc.host.createFolder({
  collectionId,
  name: 'Tokens',
  parentFolderId: /* parent id */
});

const request = await hc.host.createRequest({
  collectionId,
  folderId: folder.id,
  name: 'Login',
  method: 'POST'
});

await hc.host.moveRequest({
  collectionId,
  requestId: request.id,
  folderId: null
});
await hc.host.reorderRequests({
  collectionId,
  folderId: null,
  orderedRequestIds: [request.id]
});

await hc.host.setCollectionArchived({ collectionId, archived: true });
await hc.host.deleteRequest(request.id);
```

<HcMethod name="host.openImageView" :level="3" />

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

<HcMethod name="imports.registerHandler" :level="3" />

## hc.mcp

Register remote MCP client servers so Harbor's chat agent can discover and call tools from external MCP endpoints over Streamable HTTP or legacy SSE.

Requires the `mcp` permission. Registrations are **activation-scoped**: Harbor connects while the plugin is enabled and removes them when you dispose the returned handle or the plugin unloads. Plugin-owned servers appear as **read-only** rows in **Settings → AI & MCP** with plugin attribution; they are not copied into user MCP settings.

<HcMethod name="mcp.registerServer" :level="3" />

## hc.liveServers

Create, start, stop, and inspect Harbor Live Servers (loopback static file servers with optional CORS, path aliases, and file watching).

Requires the `live-server` permission. This is separate from [`hc.server`](/main-api#hcserver) (plugin echo server under the `server` permission).

Saved-config `update` / `delete` do **not** restart or stop a running instance. `start` returns the running instance and does **not** open a browser tab — call `hc.livePage(origin)` when you also have the `browser` permission.

```ts
export async function activate(hc: PluginContext): Promise<void> {
  const saved = await hc.liveServers.create({
    name: 'Docs preview',
    root: '/absolute/path/to/site',
    port: null,
    watch: true
  });

  const running = await hc.liveServers.start({ savedId: saved.id });
  console.log(running.origin, running.port);

  const status = await hc.liveServers.getStatus({ savedId: saved.id });
  const logs = await hc.liveServers.getLogs({ savedId: saved.id, limit: 50 });

  hc.liveServers.onRunningChanged((list) => {
    console.log('running count', list.length);
  });
  hc.liveServers.onRequestLog((entry) => {
    console.log(entry.method, entry.url, entry.statusCode);
  });
}
```

<HcMethod name="liveServers.list" :level="3" />

<HcMethod name="liveServers.get" :level="3" />

<HcMethod name="liveServers.create" :level="3" />

<HcMethod name="liveServers.update" :level="3" />

<HcMethod name="liveServers.delete" :level="3" />

<HcMethod name="liveServers.start" :level="3" />

<HcMethod name="liveServers.stop" :level="3" />

<HcMethod name="liveServers.listRunning" :level="3" />

<HcMethod name="liveServers.getStatus" :level="3" />

<HcMethod name="liveServers.getLogs" :level="3" />

<HcMethod name="liveServers.clearLogs" :level="3" />

<HcMethod name="liveServers.onRunningChanged" :level="3" />

<HcMethod name="liveServers.onRequestLog" :level="3" />

## hc.livePages

Create, update, and delete saved Live Pages (website registry rows with URL, home URL, injection scripts, pre/post request scripts, variables, headers, and auth).

Requires the `live-pages` permission. This is separate from [`hc.livePage`](/renderer-data#hclivepage) (embedded browser tab control under the `browser` permission) and from [`hc.liveServers`](/renderer-data#hcliveservers).

Registry mutations do **not** open or bind a browser tab.

```ts
export async function activate(hc: PluginContext): Promise<void> {
  const page = await hc.livePages.create({
    name: 'Docs',
    url: 'https://example.com/docs',
    homeUrl: 'https://example.com/',
    scripts: [],
    preRequestScripts: [],
    postRequestScripts: []
  });

  const listed = await hc.livePages.list();
  const found = await hc.livePages.get(page.uuid);
  await hc.livePages.update({
    ...page,
    name: 'Docs (updated)'
  });
  await hc.livePages.delete(page.id);
  console.log(listed.length, found?.name);
}
```

<HcMethod name="livePages.list" :level="3" />

<HcMethod name="livePages.get" :level="3" />

<HcMethod name="livePages.create" :level="3" />

<HcMethod name="livePages.update" :level="3" />

<HcMethod name="livePages.delete" :level="3" />

## hc.ai

Chat pointers, append-only agent instructions, turn hooks, and copy-to-chat for the AI sidebar.

Requires the `ai` permission. Registrations are **activation-scoped**: Harbor merges `agentGuidance` and `hc.ai.instructions` into the agent system prompt while the plugin is enabled and removes them on dispose or unload. Historical message badges keep working from persisted snapshots.

Plugins **cannot** rewrite Harbor's base system prompt — they only append fragments (via chat-pointer `agentGuidance`, `instructions.add`, or turn-scoped `ctx.instructions.push`).

Turn hooks (`onBeforeTurn` / `onAfterTurn`) fire **once per user chat turn** (not per LLM tool-loop step), and are unrelated to `hc.http.onBeforeSend` / `onAfterSend`.

<HcMethod name="ai.registerChatPointer" :level="3" />

<HcMethod name="ai.copyToChat" :level="3" />

<HcMethod name="ai.instructions.add" :level="3" />

<HcMethod name="ai.onBeforeTurn" :level="3" />

<HcMethod name="ai.onAfterTurn" :level="3" />

<HcMethod name="livePage" :level="2" />

## Not extensible

These built-in surfaces are not open to plugin contributions:

- **Open request tab strip** — tabs for unsaved/saved requests in the editor workspace.
- **Native window chrome** — title bar and window controls (menu contributions use the application menu only).
