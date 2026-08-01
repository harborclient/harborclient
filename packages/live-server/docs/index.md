# @harborclient/live-server

Headless HarborClient live-server host: Express static serving, path aliases,
CORS, headers, proxies, routes, custom error pages, pre/post request scripts,
file watching, and an optional supervised companion `runCommand`.

Used by the Electron GUI main process and the HarborClient CLI. Host-specific
concerns (snippets, global variables, script runner) are injected via
[`LiveServerHostProviders`](/usage#providers) so the same package runs in both
environments without embedding Electron or SQLite.

## What this package provides

- **Runtime host** — `startLiveServer` / `stopLiveServer` manage in-process
  Express servers, watchers, and companion processes.
- **App factory** — `createLiveServerApp` builds the Express app (useful for
  tests or custom Node hosts).
- **Logs** — ring-buffered access, script, and process logs, plus optional
  frozen log sessions for the GUI/CLI.
- **Config helpers** — re-exports `toLiveServerConfig` from `@harborclient/core`
  so Node hosts can keep a single live-server import.
