import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Resolves the Electron `userData` directory used by the HarborClient GUI so the
 * CLI can share the same SQLite registry and provider databases.
 *
 * Electron derives userData from `productName` ("HarborClient") on each OS.
 *
 * @param override - Optional explicit path from `--user-data`.
 * @returns Absolute path to the shared userData directory.
 */
export function resolveHarborUserDataPath(override?: string): string {
  if (override && override.trim()) {
    return override.trim();
  }

  const home = homedir();
  switch (process.platform) {
    case 'darwin':
      return join(home, 'Library', 'Application Support', 'HarborClient');
    case 'win32':
      return join(process.env.APPDATA ?? join(home, 'AppData', 'Roaming'), 'HarborClient');
    default:
      return join(process.env.XDG_CONFIG_HOME ?? join(home, '.config'), 'HarborClient');
  }
}
