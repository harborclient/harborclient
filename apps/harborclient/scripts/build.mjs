#!/usr/bin/env node
/**
 * Builds product dependencies: core, storage-sqlite, CLI, GUI, then copies
 * native CLI runtime deps beside the CLI bundle for electron-builder packaging.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptsDir, '..', '..', '..');

/**
 * Runs a pnpm filter script and exits the process on failure.
 *
 * @param filter - pnpm `--filter` package name.
 * @param script - Package script name to run.
 */
function runFilter(filter, script) {
  const result = spawnSync('pnpm', ['--filter', filter, script], {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

/**
 * Runs a node script and exits the process on failure.
 *
 * @param scriptPath - Absolute path to the script.
 */
function runNode(scriptPath) {
  const result = spawnSync('node', [scriptPath], {
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

// Rebuild natives for Electron before copying — tests may leave the Node ABI.
runNode(join(repoRoot, 'scripts', 'install-app-deps.mjs'));
runNode(join(repoRoot, 'apps', 'cli', 'scripts', 'prepare-runtime-deps.mjs'));
