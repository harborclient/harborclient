Plugin-scoped persistent storage. Keys are namespaced by plugin `id` in the main process. Requires the `storage` permission.

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

## Main entry

Optional `main` entry modules can use the same storage API. Plugin-scoped persistent key-value storage. Keys are namespaced by plugin `id` in the HarborClient main process (SQLite `plugin_storage` table). Requires the `storage` permission.

The main entry uses the same `get` / `set` API as the [renderer](/api/storage). Calls from the SES utilityProcess child are routed to the Electron main process, which reads and writes through the same backing store as renderer `hc.storage` — no custom IPC channel or renderer bridge is required.

Values must be JSON-serializable. There is no `delete` or `list` API; store structured data under a few keys when you need collections or indexes.

Use main-process storage when HTTP hooks or other main-entry logic must persist state (OAuth tokens, API key config mirrored for `onBeforeSend`, response baselines, and similar). Renderer-only settings can stay in the renderer entry.
