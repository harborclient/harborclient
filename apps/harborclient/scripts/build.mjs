#!/usr/bin/env node
/**
 * Builds product dependencies: core, storage-sqlite, CLI, then the GUI (electron-vite).
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(packageRoot, '..', '..');

/**
 * Runs a pnpm filter script and exits the process on failure.
 *
 * @param filter - pnpm `--filter` package name.
 * @param script - Package script name to run.
 */
function runFilter(filter: string, script: string): void {
  const result = spawnSync('pnpm', ['--filter', filter, script], {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

runFilter('@harborclient/core', 'build');
runFilter('@harborclient/storage-sqlite', 'build');
runFilter('@harborclient/cli', 'build');
runFilter('@harborclient/gui', 'build');
