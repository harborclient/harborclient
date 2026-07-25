/**
 * Lightweight opt-in very-verbose logging for outbound HTTP request details.
 *
 * Very-verbose mode is enabled with `-vv` / `--very-verbose` or `HARBOR_VERBOSE=2`.
 */

/**
 * Determines whether very-verbose logging should be enabled for this process.
 *
 * Reads `process.argv` for `-vv`/`--very-verbose` and `HARBOR_VERBOSE=2`.
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
 * Whether very-verbose logging is active for the lifetime of this process.
 */
export const isVeryVerbose: boolean = detectVeryVerbose();

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
