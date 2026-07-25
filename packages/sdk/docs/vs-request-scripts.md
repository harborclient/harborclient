# Plugins vs scripts

Both use the `hc` name, but they serve different purposes:

|                   | Request scripts                     | Plugins                                                                                             |
| ----------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Lifetime**      | One-shot per send                   | Long-lived until deactivated                                                                        |
| **Runtime**       | utilityProcess + SES                | Renderer: registry + IPC; main: same runner                                                         |
| **API scope**     | Request, variables, tests, response | UI contributions, themes, storage, fs, HTTP hooks, IPC, **hc.scripts** (same hc as request scripts) |
| **Where defined** | Collection or request editor        | Installed `.hcp` package                                                                            |

Request scripts cannot call plugin-only APIs. Plugins do not replace collection or request scripts for per-send logic. Main-process plugins can run the same hc API programmatically via `hc.scripts.createContext()` — see [Main API — hc.scripts](/main-api#hcscripts). For the script `hc` reference (`hc.request`, `hc.globals`, `hc.test`, and related members), see [Request scripts](https://harborclient.com/request-scripts).

Request scripts can import other snippets from the library with relative ESM paths (`import { fn } from './helper.js'`) when the snippet name ends in `.js`. See [Snippets](/snippets). Plugins ship as installable `.hcp` packages with a different layout and lifecycle.

Request scripts can read and write **global** variables with `hc.globals.get` / `hc.globals.set`; values persist to **Settings → Globals** after the send. For structured ephemeral data shared between scripts in one send (objects, arrays, mock fixtures), use `hc.data` instead — see [Request scripts — hc.data](https://harborclient.com/scripting#hcdata). Plugins read merged globals through `RequestTabContext.variables` and update globals with `hc.commands.execute('harborclient:updateGlobalVariables', …)` — see [Global variables](/renderer-data#global-variables).
