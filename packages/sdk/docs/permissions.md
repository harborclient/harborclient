# Permissions

HarborClient uses a trusted-extension model similar to VS Code or Obsidian. Permissions are shown at install time and enforced in the main process on every privileged `hc.*` call.

| Permission         | Grants                                                                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui`               | All `hc.ui.register*` methods, `hc.themes.register`, `hc.imports.registerHandler`, `registerImportHandler`, `hc.ui.showToast`, and `hc.commands.register` |
| `storage`          | Plugin-scoped persistent key-value storage via `hc.storage`                                                                                               |
| `database`         | Plugin-scoped private SQLite database via `hc.database` (one file per plugin under userData)                                                              |
| `filesystem:pick`  | Open and save dialogs; read and write only user-selected paths                                                                                            |
| `filesystem:read`  | Read from allowlisted paths (plugin directory plus granted paths)                                                                                         |
| `filesystem:write` | Write to allowlisted paths                                                                                                                                |
| `http`             | Hook into or send HTTP from main via `hc.http.onBeforeSend` / `onAfterSend`                                                                               |
| `scripts:inject`   | Inject and observe pre/post request scripts via `hc.http.onBeforeScripts` / `onAfterScripts`                                                              |
| `network`          | Outbound HTTP from the renderer via `hc.host.fetch` (gated by Settings → General)                                                                         |
| `ipc`              | Register custom IPC handlers via `hc.ipc.handle`                                                                                                          |
| `server`           | Local HTTP echo server via `hc.server` (express listener in the Electron main process)                                                                    |
| `live-server`      | Create, start, stop, and inspect Harbor Live Servers via `hc.liveServers`                                                                                 |
| `live-pages`       | Create, update, and delete saved Live Pages (websites) via `hc.livePages`                                                                                 |
| `mcp`              | Register remote MCP client servers for Harbor's chat agent via `hc.mcp.registerServer`                                                                    |
| `ai`               | Register `@plugin…` chat pointers and copy context into the AI sidebar via `hc.ai`                                                                        |
| `browser`          | Open and control embedded browser tabs via `hc.livePage` (focus, close, DOM, viewport/full-page screenshot; screenshot writes need `filesystem:write`)    |

Filesystem access never uses raw Node `fs` in plugin code. Use `hc.fs.*` helpers only; the host checks permissions and path allowlists on each call.

Paths the user selects through `hc.fs.pickFile`, `hc.fs.pickDirectory`, or `hc.fs.saveFile` are added to the allowlist automatically and **persist across app restarts**. The host restores those grants when the plugin loads again; plugins do not need to re-prompt every session for the same file.

Declare required permissions in [Manifest](/manifest) under `permissions`.

### `live-server`

Grants `hc.liveServers` for Harbor Live Server CRUD, start/stop, status, and access logs. This is separate from the `server` permission, which only covers the plugin-owned echo server (`hc.server`). Saved-config updates and deletes do not restart or stop running instances. Start does not open a browser tab; use `hc.livePage` when the `browser` permission is also granted.

### `live-pages`

Grants `hc.livePages` for saved Live Page (website) registry CRUD — list, get, create, update, and delete. Mutations update the sidebar registry only; they do **not** open or bind a browser tab. For tab control use `hc.livePage` with the `browser` permission. This is separate from `live-server` (local static file servers).

### `browser`

Grants `hc.livePage` for opening and controlling embedded browser tabs (focus, close, DOM query/evaluate/inject, viewport or full-page screenshot). Access is granted when the user installs or enables a plugin that declares `browser` — it is **not** gated by Settings → General → Allow script live page access (that setting applies only to request scripts). `page.screenshot` also requires `filesystem:write` to save the PNG. Pass `{ fullPage: true }` for a scroll-and-stitch capture.
