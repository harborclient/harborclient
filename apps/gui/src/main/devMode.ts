import { app } from 'electron';

/**
 * Returns true when `--dev-mode` was passed on the command line.
 *
 * @param argv - Process argv including Electron flags.
 * @returns True when explicit dev-mode was requested on the command line.
 */
export function isDevModeFlagEnabled(argv: string[] = process.argv): boolean {
  return argv.includes('--dev-mode');
}

/**
 * Returns true when developer tooling should be available.
 *
 * Unpackaged builds always qualify; packaged builds qualify only with `--dev-mode`.
 *
 * @param argv - Process argv including Electron flags.
 * @returns True when DevTools menu and inspect-element context menu should be enabled.
 */
export function isDeveloperToolsEnabled(argv: string[] = process.argv): boolean {
  return !app.isPackaged || isDevModeFlagEnabled(argv);
}
