/**
 * Product-level help and version output for the HarborClient binary.
 */

/**
 * Prints combined GUI + CLI usage to stdout.
 */
export function printHelp(): void {
  console.log(`HarborClient — API client (GUI + CLI)

Usage:
  harborclient                         Open the desktop app
  harborclient [gui-options]           Open the desktop app with options
  harborclient <METHOD> <url> [opts]   Send an ad-hoc HTTP request
  harborclient run <collection> [opts] Run a saved collection
  harborclient workflow run <wf> [opts] Run a saved workflow
  harborclient servers run <server>    Start a saved live server
  harborclient -h, --help              Show this help
  harborclient -V, --version           Show version

GUI options (examples):
  --theme <id>                 Session theme override
  --seed                       Import built-in collections when missing
  --verbose / -v               Verbose main-process logging
  harborclient://...           Handle a HarborClient deep link

Ad-hoc CLI options:
  -H, --header <Name: value>   Add a request header (repeatable)
  -d, --data <body>            Request body
  --json <body>                JSON body (sets Content-Type)
  --timeout <ms>               Request timeout in milliseconds
  --no-verify-ssl              Disable TLS certificate verification
  -v, --verbose                Print response headers

Collection run options:
  run <name-or-uuid>           Run all requests in a saved collection
  --user-data <path>           Override Electron userData directory
  --stop-on-failure            Stop after the first failed request

Workflow run options:
  workflow run <name-or-uuid>  Run a saved workflow headlessly
  --user-data <path>           Override Electron userData directory
  --stop-on-failure            Stop after the first failed request
  --export <dir>               Write a workflow-run JSON export to this directory

Live server options:
  servers run <name-or-uuid>   Start a saved live server until Ctrl+C
  --user-data <path>           Override Electron userData directory

Examples:
  harborclient
  harborclient GET https://httpbin.org/get
  harborclient POST https://httpbin.org/post --json '{"ok":true}'
  harborclient run "My Collection"
  harborclient workflow run "My Workflow" --export ./results
  harborclient servers run "Echo Server"
`);
}

/**
 * Prints the product version to stdout.
 *
 * @param version - Semver string from the packaged app or product package.
 */
export function printVersion(version: string): void {
  console.log(`HarborClient ${version}`);
}
