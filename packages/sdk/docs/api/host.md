# Host

Typed wrappers for built-in request editor commands and library APIs.

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

Typed wrappers for built-in HarborClient request editor commands. Requires the `ui` permission. Prefer these over stringly-typed `hc.commands.execute('harborclient:…')`.

<HcMethod name="host.applyRequestDraft" :level="2" />

<HcMethod name="host.createCollection" :level="2" />

<HcMethod name="host.fetch" :level="2" />

<HcMethod name="host.loadRequest" :level="2" />

<HcMethod name="host.openImageView" :level="2" />

<HcMethod name="host.openRequestDraft" :level="2" />

<HcMethod name="host.send" :level="2" />

<HcMethod name="host.showEntityContextMenu" :level="2" />
