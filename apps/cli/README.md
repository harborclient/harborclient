# HarborClient CLI

Command-line runner powered by `@harborclient/core`. Shares the same HTTP stack,
cookie jar, scripts, and SQLite collections as the HarborClient GUI.

End users invoke the CLI through the product `harborclient` binary (empty argv
opens the GUI; HTTP methods, `run`, and `workflow` route here). For local
development you can also call the CLI package directly via `pnpm cli`.

## Install / build

From the monorepo root:

```bash
pnpm install
pnpm --filter @harborclient/cli build
pnpm cli -- GET https://httpbin.org/get
```

## Ad-hoc requests

```bash
harborclient GET https://httpbin.org/get
harborclient POST https://httpbin.org/post --json '{"hello":"world"}'
harborclient GET https://httpbin.org/headers -H 'X-Token: secret' -v
```

## Run a saved collection

Uses the same Electron `userData` directory as the GUI (for example
`~/.config/HarborClient` on Linux):

```bash
harborclient run "My Collection"
harborclient run <collection-uuid> --stop-on-failure
harborclient run "My Collection" --user-data /path/to/HarborClient
```

## Run a saved workflow

Plays a workflow headlessly (request load/draft/send and environment activate;
UI actions such as tabs and pages are skipped):

```bash
harborclient workflow run "My Workflow"
harborclient workflow run <workflow-uuid> --stop-on-failure
harborclient workflow run "My Workflow" --export ./results
harborclient workflow run "My Workflow" --user-data /path/to/HarborClient
```

## Help

Product-level help (GUI + CLI): `harborclient --help`

Direct CLI package help: `pnpm cli -- --help`
