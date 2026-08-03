# Main API

Optional `main` entry modules export `activate(hc)` and `deactivate()` like renderer entries, but run inside the SES-hardened utilityProcess. Use this entry for HTTP hooks and custom IPC — not for React UI.

Import `MainPluginContext` from `@harborclient/sdk` (or `@harborclient/sdk/main` for main-only plugins) and type your entry as `activate(hc: MainPluginContext)`.

See [Architecture](/architecture#two-runtimes) for how the main entry fits alongside the renderer entry.

## hc.storage

Plugin-scoped persistent key-value storage. Keys are namespaced by plugin `id` in the HarborClient main process (SQLite `plugin_storage` table). Requires the `storage` permission.

The main entry uses the same `get` / `set` API as the [renderer](/renderer-data#hcstorage). Calls from the SES utilityProcess child are routed to the Electron main process, which reads and writes through the same backing store as renderer `hc.storage` — no custom IPC channel or renderer bridge is required.

Values must be JSON-serializable. There is no `delete` or `list` API; store structured data under a few keys when you need collections or indexes.

Use main-process storage when HTTP hooks or other main-entry logic must persist state (OAuth tokens, API key config mirrored for `onBeforeSend`, response baselines, and similar). Renderer-only settings can stay in the renderer entry.

<HcMethod name="storage.get" :level="3" />

<HcMethod name="storage.set" :level="3" />

## hc.database

Plugin-scoped SQLite database with the same API as the [renderer](/renderer-data#hcdatabase). Requires the `database` permission.

The main entry routes SQL through the Electron main process, which opens one isolated file per plugin id. Use this from HTTP hooks when you need relational persistence without a renderer bridge.

See [Themes and storage → hc.database](/renderer-data#hcdatabase) for method signatures, migration examples, and transaction usage.

<HcMethod name="http.onBeforeSend" :level="2" />

<HcMethod name="http.onAfterSend" :level="2" />

<HcMethod name="http.onBeforeScripts" :level="2" />

<HcMethod name="http.onAfterScripts" :level="2" />

<HcMethod name="ipc.handle" :level="2" />

## hc.server

**Requires the `server` permission.**

Runs a local HTTP echo server in the Electron main process (express). Port `0` selects the first available non-privileged port from the OS. Register `onRequest` before calling `start` so incoming traffic is routed through your handler.

```typescript
import type { MainPluginContext } from '@harborclient/sdk';
import { createHttpResponse } from '@harborclient/sdk/runtime-utils';

export function activate(hc: MainPluginContext): void {
  hc.server.onRequest(async (request) => {
    // Legacy: return custom JSON (always HTTP 200), or undefined for the default echo payload.
    if (request.path === '/echo') {
      return { ...request.echo, custom: true };
    }

    // Structured: custom status, headers, body, and delay.
    return createHttpResponse({
      status: 404,
      headers: { 'X-Mock': '1' },
      body: { error: 'not found', path: request.path },
      delayMs: 0
    });
  });
  void hc.server.start({ port: 0 }).then(({ port }) => {
    console.log(`Echo server listening on http://localhost:${port}`);
  });
}
```

<HcMethod name="server.start" :level="3" />

<HcMethod name="server.stop" :level="3" />

<HcMethod name="server.onRequest" :level="3" />

<HcMethod name="scripts" :level="2" />

### PluginScriptContext

| Method                     | Description                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `setVariable(name, value)` | Injects a global variable visible to subsequent `run()` calls.                                                           |
| `setFunction(name, fn)`    | Injects a global function; overrides built-in globals such as `console` when names collide.                              |
| `run(script)`              | Evaluates script synchronously; returns {@link PluginScriptRunResult} with hc mutations and the last-expression `value`. |

`run()` returns the full structured result: mutated `request`, `variableSets`, `collectionVariableSets`, `environmentVariableSets`, `globalVariableSets`, `collectionHeaders`, `tests`, `logs`, `data` (the final `hc.data` bag), optional `error`, and `value` (the script's last expression).

The hc surface matches pre/post request scripts: `hc.request`, `hc.collection`, `hc.environment`, `hc.globals`, `hc.data`, `hc.test`, `hc.expect`, and `hc.response` (when `init.response` is provided). Pass optional `init.data` to seed `hc.data` when creating a context. See [Request scripts](https://harborclient.com/request-scripts) for the full hc reference, including [hc.data](https://harborclient.com/scripting#hcdata).

Tests, logs, and `hc.data` accumulate across multiple `run()` calls on the same context. Request and variable mutations persist until you create a new context.
