# Plugins vs scripts

Both use the `hc` name, but they serve different purposes:

|                   | Request scripts                     | Plugins                                                                                             |
| ----------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Lifetime**      | One-shot per send                   | Long-lived until deactivated                                                                        |
| **Runtime**       | utilityProcess + SES                | Renderer: registry + IPC; main: same runner                                                         |
| **API scope**     | Request, variables, tests, response | UI contributions, themes, storage, fs, HTTP hooks, IPC, **hc.scripts** (same hc as request scripts) |
| **Where defined** | Collection or request editor        | Installed `.hcp` package                                                                            |

Request scripts cannot call plugin-only APIs (storage, UI, IPC, and so on). Plugins do not replace collection or request scripts for per-send logic — they can **inject** additional scripts into a send via `hc.http.onBeforeScripts` (requires `scripts:inject`). Main-process plugins can also run the same hc API programmatically via `hc.scripts.createContext()` — see [Scripts](/api/scripts). For the script `hc` reference (`hc.request`, `hc.globals`, `hc.test`, and related members), see [Request scripts](https://harborclient.com/request-scripts).

### How plugins and scripts communicate

| Channel                                      | Direction           | Notes                                                                                                                                                                                 |
| -------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hc.http.onBeforeScripts` / `onAfterScripts` | Plugin ↔ scripts    | Inject stage-tagged scripts; seed and read the shared `hc.data` bag; observe tests/logs after a stage. Requires `scripts:inject`.                                                     |
| `hc.http.onBeforeSend` / `onAfterSend`       | Plugin ↔ wire       | Mutate or observe the HTTP exchange between pre and post scripts. Requires `http`.                                                                                                    |
| Globals / collection / environment variables | Both (async)        | Scripts write with `hc.globals` / `hc.collection.variables` / `hc.environment`; values persist after the send. Plugins read later via `RequestTabContext.variables` or host commands. |
| Script editor actions                        | User click → plugin | Edit-time only; not a send-time notification.                                                                                                                                         |

Request scripts can import other snippets from the library with relative ESM paths (`import { fn } from './helper.js'`) when the snippet name ends in `.js`. See [Snippets](/snippets). Plugins ship as installable `.hcp` packages with a different layout and lifecycle.

Request scripts can read and write **global** variables with `hc.globals.get` / `hc.globals.set`; values persist to **Settings → Globals** after the send. For structured ephemeral data shared between scripts in one send (objects, arrays, mock fixtures) — and now also with plugins that hold `scripts:inject` — use `hc.data` instead — see [Request scripts — hc.data](https://harborclient.com/scripting#hcdata). Plugins read merged globals through `RequestTabContext.variables` and update globals with `hc.commands.execute('harborclient:updateGlobalVariables', …)` — see [Global variables](/api/commands).
