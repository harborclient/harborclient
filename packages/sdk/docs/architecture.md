# Architecture

## Two runtimes

Plugins can ship a renderer entry, a main entry, or both:

| Entry        | Runs in              | Purpose                                   | Sandbox                                        |
| ------------ | -------------------- | ----------------------------------------- | ---------------------------------------------- |
| **renderer** | Renderer (React)     | Settings panels, sidebar UI, request tabs | No SES — `contextIsolation` plus IPC-only `hc` |
| **main**     | utilityProcess + SES | HTTP hooks, custom IPC, background logic  | SES `lockdown()` in the child process only     |

Renderer UI uses `hc.react`, the host's React instance. **Do not bundle React** in your plugin; the host installs it before `activate(hc)` runs. Use the JSX runtime documented in [React and JSX](/renderer-overview#react-and-jsx).

Main-process plugin code reuses the same utilityProcess script runner infrastructure as [request scripts](https://harborclient.com/request-scripts). `lockdown()` runs only in that child process — never in the Electron main process or renderer.

```mermaid
flowchart TB
  subgraph installFlow [Install]
    hcp[Plugin hcp file] --> unzip["userData/plugins/id/"]
    unzip --> validate[Validate manifest]
    validate --> confirm[Permissions modal]
  end
  subgraph rendererFlow [Renderer entry]
    load[Load renderer.js] --> activate["activate(hc)"]
    activate --> uiReg[hc.ui.register*]
    activate --> storageIpc[hc.storage via IPC]
  end
  subgraph mainFlow [Main entry optional]
    runner[utilityProcess SES runner] --> hooks[hc.http hooks]
  end
  confirm --> load
  activate --> runner
```

## Lifecycle

```mermaid
flowchart TD
  install[Install from hcp] --> discover[Scan plugins on boot]
  discover --> enable[Enable plugin]
  enable --> lazy[Lazy activation]
  lazy --> activate["activate(hc)"]
  activate --> run[Plugin running]
  run --> deactivate["deactivate() + dispose tracked registrations"]
  deactivate --> uninstall[Uninstall removes directory]
```

1. **Install** — HarborClient unpacks the `.hcp` file to `userData/plugins/<id>/`, validates `manifest.json`, and shows a permissions confirmation dialog.
2. **Discovery** — On startup, HarborClient scans `plugins/*/manifest.json` for installed plugins and reloads any **unpacked** plugin paths saved from development sessions.
3. **Activation** — Plugins activate lazily (for example when the user opens a contributed settings section). The host loads the entry module and calls `activate(hc)`.
4. **Deactivation** — On disable or unload, the host tears down tracked registrations automatically, then calls `deactivate()` if exported.
5. **Uninstall** — Removes an installed plugin directory and clears stored enablement state. Unpacked plugins are removed from the dev registry only; your source folder on disk is not deleted.

Registrations from `hc.ui.*` and similar APIs return **disposables** that the host tracks automatically on deactivation. Dispose custom resources (timers, focus sync, etc.) in `deactivate()` or React effect cleanup.

See [Permissions](/permissions) for the capability model and [Dev workflow](/dev-workflow) for unpacked development loading.
