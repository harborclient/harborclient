/**
 * Lightweight main-process logger with an opt-in verbose mode.
 *
 * Verbose mode is enabled with the `-v` / `--verbose` command-line flag or by
 * setting `HARBOR_VERBOSE=1`. In dev the flag must reach Electron, e.g.
 * `pnpm dev -- -v`; in a packaged build use `./HarborClient -v`. Standard
 * warnings and errors always log regardless of verbose mode.
 */

/**
 * Determines whether verbose logging should be enabled for this process.
 *
 * Reads `process.argv` for `-v`/`--verbose` and the `HARBOR_VERBOSE`
 * environment variable so the flag works in both dev and packaged builds.
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
 * Whether verbose logging is active for the lifetime of this process.
 */
export const isVerbose: boolean = detectVerbose();

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
