HTTP lifecycle events are available in both the renderer and main entries. Requires the `http` permission. Registration disposables are tracked automatically.

## Renderer

Use `hc.http.onAfterSend` when you only need to react to completed sends in the UI — no main entry or polling required. Prefer this over a main entry + custom IPC + polling for history or recent-requests panels.

## Main entry

Optional `main` entry modules export `activate(hc)` and `deactivate()` like renderer entries, but run inside the SES-hardened utilityProcess. Use this entry for HTTP hooks and custom IPC — not for React UI.

Import `MainPluginContext` from `@harborclient/sdk` (or `@harborclient/sdk/main` for main-only plugins) and type your entry as `activate(hc: MainPluginContext)`.

HTTP lifecycle hooks (`onBeforeSend`, `onAfterSend`, `onBeforeScripts`, `onAfterScripts`) are typically registered from the main entry. See [Architecture](/architecture#two-runtimes).
