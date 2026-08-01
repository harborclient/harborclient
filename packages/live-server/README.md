# @harborclient/live-server

Headless HarborClient live-server host: Express static serving, path aliases,
CORS, headers, proxies, routes, pre/post request scripts, file watching, and an
optional supervised companion `runCommand`.

Used by the Electron GUI main process and the `harborclient servers run` CLI.
Host-specific concerns (snippets, global variables, script runner) are injected
via `LiveServerHostProviders`.
