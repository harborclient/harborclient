/**
 * Returns true when `--quit-without-warning` was passed on the command line.
 *
 * @param argv - Process argv including Electron flags.
 * @returns True when close/quit should skip the unsaved-changes prompt.
 */
export function isQuitWithoutWarningFlagEnabled(argv: string[] = process.argv): boolean {
  return argv.includes('--quit-without-warning');
}
