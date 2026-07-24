# Scripting

Pre- and post-request scripts run in an [SES](https://github.com/endojs/endo/tree/master/packages/ses) lockdown compartment (`scripting/scriptRunner.ts`). The sandbox exposes a HarborClient script API (request/response mutation, variables, cookies, assertions) while keeping Node and Electron APIs out of script scope.

Key pieces:

- **`scriptEvaluator`** — evaluates script source inside the compartment
- **`scriptApi`** — portable request/response/variable helpers
- **`scriptExpect` / `scriptResponseAssertions`** — Chai-based and HarborClient assertion helpers
- **`scriptSnippetBundler`** — bundles snippet sources for injection

Hosts that need network or file access from scripts bridge those calls through the runner host (see GUI and CLI adapters).
