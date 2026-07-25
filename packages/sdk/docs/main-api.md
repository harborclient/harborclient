# Main API

Optional `main` entry modules export `activate(hc)` and `deactivate()` like renderer entries, but run inside the SES-hardened utilityProcess. Use this entry for HTTP hooks and custom IPC — not for React UI.

Import `MainPluginContext` from `@harborclient/sdk` (or `@harborclient/sdk/main` for main-only plugins) and type your entry as `activate(hc: MainPluginContext)`.

See [Architecture](/architecture#two-runtimes) for how the main entry fits alongside the renderer entry.

## hc.storage

Plugin-scoped persistent key-value storage. Keys are namespaced by plugin `id` in the HarborClient main process (SQLite `plugin_storage` table). Requires the `storage` permission.

The main entry uses the same `get` / `set` API as the [renderer](/renderer-data#hcstorage). Calls from the SES utilityProcess child are routed to the Electron main process, which reads and writes through the same backing store as renderer `hc.storage` — no custom IPC channel or renderer bridge is required.

Values must be JSON-serializable. There is no `delete` or `list` API; store structured data under a few keys when you need collections or indexes.

Use main-process storage when HTTP hooks or other main-entry logic must persist state (OAuth tokens, API key config mirrored for `onBeforeSend`, response baselines, and similar). Renderer-only settings can stay in the renderer entry.

### hc.storage.get(key)

**Signature:** `<T>(key: string) => Promise<T | undefined>`

Returns the stored value, or `undefined` if the key has never been set.

```typescript
import type { MainPluginContext } from '@harborclient/sdk';

export function activate(hc: MainPluginContext): void {
  hc.http.onBeforeSend(async (request) => {
    const token = await hc.storage.get<string>('accessToken');
    if (token) {
      request.headers.Authorization = `Bearer ${token}`;
    }
  });
}
```

### hc.storage.set(key, value)

**Signature:** `<T>(key: string, value: T) => Promise<void>`

Persists a JSON-serializable value.

```typescript
await hc.storage.set('accessToken', refreshedToken);
await hc.storage.set('links', [{ collectionId: 1, dotenvPath: '/path/to/.env' }]);
```

Invalid JSON already stored for a key causes `get` to throw with a plugin-scoped error message (same behavior as the renderer API).

## hc.database

Plugin-scoped SQLite database with the same API as the [renderer](/renderer-data#hcdatabase). Requires the `database` permission.

The main entry routes SQL through the Electron main process, which opens one isolated file per plugin id. Use this from HTTP hooks when you need relational persistence without a renderer bridge.

See [Themes and storage → hc.database](/renderer-data#hcdatabase) for method signatures, migration examples, and transaction usage.

## hc.http.onBeforeSend(handler)

**Signature:** `(handler: (request) => void \| Promise<void>) => Disposable`

Register a callback that runs before each outgoing HTTP request. Mutate the request object to change method, URL, headers, or body. Requires the `http` permission. Remove a header with `delete request.headers['Header-Name']`.

```typescript
import type { MainPluginContext } from '@harborclient/sdk';

export function activate(hc: MainPluginContext): void {
  hc.http.onBeforeSend(async (request) => {
    request.headers['X-Plugin-Trace'] = '1';
    delete request.headers['Authorization'];
  });
}
```

## hc.http.onAfterSend(handler)

**Signature:** `(handler: (request, response) => void \| Promise<void>) => Disposable`

Register a callback that runs after the response is received. Requires the `http` permission.

For UI-only plugins that react to completed sends (history, recent-requests, response diff), prefer renderer-side `hc.http.onAfterSend` in the renderer entry — it fires in-process with no main entry, custom IPC channel, or polling. Use this main-process hook when you need to run logic in the SES-hardened utilityProcess or mutate shared main-side state.

## hc.ipc.handle(channel, handler)

**Signature:** `(channel: string, handler: (...args) => unknown) => Disposable`

Expose an RPC channel callable from the renderer half of the same plugin. Requires the `ipc` permission.

Main-process hooks are invoked by posting work to the utilityProcess runner; the main process applies mutations and enforces permissions before and after each callback.

See the [Request logger example](/examples/request-logger) for a main-only plugin using HTTP hooks.

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

### hc.server.start(options?)

**Signature:** `(options?: { port?: number }) => Promise<{ port: number }>`

Starts listening. Returns the assigned port after the server accepts connections.

### hc.server.stop()

**Signature:** `() => Promise<void>`

Stops the echo server owned by this plugin.

### hc.server.onRequest(handler)

**Signature:** `(handler: (request) => unknown | PluginServerHttpResponse | Promise<...>) => Disposable`

Invoked for each incoming HTTP request. The `request` object includes a default `echo` payload (args, data, files, form, headers, json, origin, url).

Return either:

- A JSON-serializable value for a **legacy** body-only response (always HTTP 200 + `application/json`), or
- A **structured** `PluginServerHttpResponse` with `kind: 'http-response'` (use `createHttpResponse(...)` from `@harborclient/sdk/runtime-utils`) for custom status, headers, body, and `delayMs`.

String `body` values are sent as raw text (default `text/plain` unless you set `Content-Type`). Other bodies use JSON.

Multiple handlers may be registered; each call returns a `Disposable` that removes only that handler. Handlers run sequentially in registration order. When a handler returns `undefined` or `null`, the host keeps the result from the previous handler (starting from the default echo payload).

## hc.scripts

**Signature:** `(init?: PluginScriptContextInit) => PluginScriptContext`

Creates a script sandbox that exposes the **same `hc` object** as collection and request pre/post scripts. Use it to run tests, mutate a request snapshot, or read a response with `hc.response.json()` inside your main entry.

No extra permission is required. Contexts start with only the hc API plus globals you inject with `setVariable` and `setFunction`.

```typescript
import type { MainPluginContext } from '@harborclient/sdk';

export function activate(hc: MainPluginContext): void {
  const context = hc.scripts.createContext({
    phase: 'post',
    request: {
      method: 'GET',
      url: 'https://api.example.com/users',
      headers: [],
      params: [],
      body: '',
      bodyType: 'none'
    },
    response: {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: '{"ok":true}',
      timeMs: 12,
      sizeBytes: 11
    },
    variables: { token: 'abc' }
  });

  context.setFunction('console', console);

  const result = context.run(`
    const data = hc.response.json();
    hc.test('is ok', () => hc.expect(data.ok).to.equal(true));
    hc.request.variables.set('lastStatus', String(hc.response.code));
    data.ok;
  `);

  // result.value === true
  // result.tests, result.variableSets, result.logs, result.request, ...
}
```

### PluginScriptContext

| Method                     | Description                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `setVariable(name, value)` | Injects a global variable visible to subsequent `run()` calls.                                                           |
| `setFunction(name, fn)`    | Injects a global function; overrides built-in globals such as `console` when names collide.                              |
| `run(script)`              | Evaluates script synchronously; returns {@link PluginScriptRunResult} with hc mutations and the last-expression `value`. |

`run()` returns the full structured result: mutated `request`, `variableSets`, `collectionVariableSets`, `environmentVariableSets`, `globalVariableSets`, `collectionHeaders`, `tests`, `logs`, `data` (the final `hc.data` bag), optional `error`, and `value` (the script's last expression).

The hc surface matches pre/post request scripts: `hc.request`, `hc.collection`, `hc.environment`, `hc.globals`, `hc.data`, `hc.test`, `hc.expect`, and `hc.response` (when `init.response` is provided). Pass optional `init.data` to seed `hc.data` when creating a context. See [Request scripts](https://harborclient.com/request-scripts) for the full hc reference, including [hc.data](https://harborclient.com/scripting#hcdata).

Tests, logs, and `hc.data` accumulate across multiple `run()` calls on the same context. Request and variable mutations persist until you create a new context.
