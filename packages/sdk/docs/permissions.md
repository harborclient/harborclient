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
| `http`             | Hook into or send HTTP from main via `hc.http`                                                                                                            |
| `network`          | Outbound HTTP from the renderer via `hc.host.sendHttpRequest` (gated by Settings → General)                                                               |
| `ipc`              | Register custom IPC handlers via `hc.ipc.handle`                                                                                                          |
| `server`           | Local HTTP echo server via `hc.server` (express listener in the Electron main process)                                                                    |
| `mcp`              | Register remote MCP client servers for Harbor's chat agent via `hc.mcp.registerServer`                                                                    |

Filesystem access never uses raw Node `fs` in plugin code. Use `hc.fs.*` helpers only; the host checks permissions and path allowlists on each call.

Paths the user selects through `hc.fs.pickFile`, `hc.fs.pickDirectory`, or `hc.fs.saveFile` are added to the allowlist automatically and **persist across app restarts**. The host restores those grants when the plugin loads again; plugins do not need to re-prompt every session for the same file.

Declare required permissions in [Manifest](/manifest) under `permissions`.
