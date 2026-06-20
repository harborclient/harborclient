import { describe } from 'vitest';

/**
 * Native modules are rebuilt for Electron during postinstall; vitest uses system Node.
 * `pnpm test` runs `scripts/rebuild-for-node.mjs` before vitest to match the test runtime.
 */
function isCi(): boolean {
  return process.env.CI === 'true';
}

/**
 * Returns true when better-sqlite3 loads and can open an in-memory database.
 */
export function sqliteAvailable(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3') as typeof import('better-sqlite3');
    const db = new Database(':memory:');
    db.close();
    return true;
  } catch {
    return false;
  }
}

function nativeDescribe(available: () => boolean, moduleName: string): typeof describe {
  const loadable = available();
  if (!loadable && isCi()) {
    throw new Error(
      `${moduleName} must be loadable in CI. Run "node scripts/rebuild-for-node.mjs" before vitest.`
    );
  }
  return (loadable ? describe : describe.skip) as typeof describe;
}

export const describeSqlite = nativeDescribe(sqliteAvailable, 'better-sqlite3');
