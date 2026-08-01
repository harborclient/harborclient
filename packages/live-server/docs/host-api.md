# Host API

Public surface from `@harborclient/live-server`:

## Runtime control

| Export | Description |
| --- | --- |
| `startLiveServer` | Listen on a free (or configured) port; start watcher and optional `runCommand` |
| `stopLiveServer` | Stop one instance by runtime id |
| `stopAllLiveServers` | Stop every running instance |
| `listRunningLiveServers` | Snapshot of running instances |
| `updateLiveServerScripts` | Hot-apply pre/post request scripts without restart |

## Event handlers

Register optional callbacks (pass `null` to clear):

- `setLiveServersChangedHandler` — running list changed
- `setLiveServerFileChangedHandler` — watched file change
- `setLiveServerRequestLogHandler` — access log line
- `setLiveServerScriptLogHandler` — script console/test/error line
- `setLiveServerProcessLogHandler` — companion process output

## Logs

```ts
import {
  getLiveServerLogs,
  clearLiveServerLogs,
  createLiveServerLogSession,
  freezeLiveServerLogSession,
  listLiveServerLogSessions,
  clearAllLiveServerLogSessions,
  setLiveServerLogSessionsChangedHandler
} from '@harborclient/live-server';
```

Ring buffers store access, script, and process entries per instance.
Log sessions freeze a snapshot for the GUI/CLI history UI.

## App factory and ports

```ts
import {
  createLiveServerApp,
  findFreePort,
  isPortFree,
  LIVE_SERVER_PORT_BASE,
  LIVE_SERVER_PORT_MAX,
  resolveLiveServerOrigin,
  resolveLiveServerOriginHost
} from '@harborclient/live-server';
```

`createLiveServerApp` builds the Express app used by the host (static root,
aliases, CORS, headers, proxies, routes, error pages, scripts). Port helpers
auto-select from `LIVE_SERVER_PORT_BASE` (5500) through `LIVE_SERVER_PORT_MAX`.

## Config re-export

```ts
import { toLiveServerConfig } from '@harborclient/live-server';
```

Re-exported from `@harborclient/core/types` so Node hosts can keep a single
live-server import for config normalization.
