/**
 * Returns true when `--pick-theme` was passed on the command line.
 *
 * @param argv - Process argv including Electron flags.
 * @returns True when the theme picker modal should open regardless of first-run state.
 */
export function isPickThemeFlagEnabled(argv: string[] = process.argv): boolean {
  return argv.includes('--pick-theme');
}
