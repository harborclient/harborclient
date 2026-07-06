/**
 * Lightweight main-process logger with opt-in verbose and very-verbose modes.
 *
 * Verbose mode is enabled with `-v` / `--verbose` or `HARBOR_VERBOSE=1`. Very-verbose
 * mode adds general outbound HTTP request logging on top of verbose output and is enabled with
 * `-vv` / `--very-verbose` or `HARBOR_VERBOSE=2`. Verbose mode also logs MCP client/server
 * connection lifecycle and outgoing MCP client HTTP requests. In dev the flags must reach
 * e.g. `pnpm dev -- -v` or `pnpm dev -- -vv`; in a packaged build use
 * `./HarborClient -v` or `./HarborClient -vv`. Standard warnings and errors always log
 * regardless of verbose mode.
 */

/**
 * Determines whether very-verbose logging should be enabled for this process.
 *
 * Reads `process.argv` for `-vv`/`--very-verbose` and `HARBOR_VERBOSE=2` so the flag
 * works in both dev and packaged builds.
 *
 * @returns True when very-verbose logging is requested.
 */
function detectVeryVerbose(): boolean {
  return (
    process.argv.includes('-vv') ||
    process.argv.includes('--very-verbose') ||
    process.env['HARBOR_VERBOSE'] === '2'
  );
}

/**
 * Determines whether verbose logging should be enabled for this process.
 *
 * Reads `process.argv` for `-v`/`--verbose` and `HARBOR_VERBOSE=1`. Very-verbose mode
 * implies verbose logging.
 *
 * @returns True when verbose logging is requested.
 */
function detectVerbose(): boolean {
  return (
    process.argv.includes('-v') ||
    process.argv.includes('--verbose') ||
    process.env['HARBOR_VERBOSE'] === '1'
  );
}

/**
 * Whether very-verbose logging is active for the lifetime of this process.
 */
export const isVeryVerbose: boolean = detectVeryVerbose();

/**
 * Whether verbose logging is active for the lifetime of this process.
 */
export const isVerbose: boolean = detectVerbose() || isVeryVerbose;

/**
 * Logs a message only when verbose mode is enabled.
 *
 * Use for high-volume diagnostic output (startup steps, per-connection mount
 * details) that would be noise during normal operation.
 *
 * @param args - Values forwarded to `console.log`.
 */
export function logVerbose(...args: unknown[]): void {
  if (isVerbose) {
    console.log('[verbose]', ...args);
  }
}

/**
 * Logs outbound HTTP request details only when very-verbose (`-vv`) is enabled.
 *
 * Use for method, URL, request headers, and request body. Response headers and
 * response bodies are never logged through this helper.
 *
 * @param args - Values forwarded to `console.log`.
 */
export function logRequest(...args: unknown[]): void {
  if (isVeryVerbose) {
    console.log('[request]', ...args);
  }
}
