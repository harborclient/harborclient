# Scripts

Programmatic request-script execution from the main entry via `hc.scripts.createContext()`. Requires appropriate script permissions.

### PluginScriptContext

| Method                     | Description                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `setVariable(name, value)` | Injects a global variable visible to subsequent `run()` calls.                                                           |
| `setFunction(name, fn)`    | Injects a global function; overrides built-in globals such as `console` when names collide.                              |
| `run(script)`              | Evaluates script synchronously; returns {@link PluginScriptRunResult} with hc mutations and the last-expression `value`. |

`run()` returns the full structured result: mutated `request`, `variableSets`, `collectionVariableSets`, `environmentVariableSets`, `globalVariableSets`, `collectionHeaders`, `tests`, `logs`, `data` (the final `hc.data` bag), optional `error`, and `value` (the script's last expression).

The hc surface matches pre/post request scripts: `hc.request`, `hc.collection`, `hc.environment`, `hc.globals`, `hc.data`, `hc.test`, `hc.expect`, and `hc.response` (when `init.response` is provided). Pass optional `init.data` to seed `hc.data` when creating a context. See [Request scripts](https://harborclient.com/request-scripts) for the full hc reference, including [hc.data](https://harborclient.com/scripting#hcdata).

Tests, logs, and `hc.data` accumulate across multiple `run()` calls on the same context. Request and variable mutations persist until you create a new context.

<HcMethod name="scripts" :level="2" />
