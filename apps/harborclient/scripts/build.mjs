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
 * Whether child processes should run through a shell.
 *
 * Windows cannot spawn `pnpm.cmd` shims with `shell: false` (ENOENT), so the
 * release matrix must use a shell there. Unix keeps `shell: false`.
 */
const useShell = process.platform === 'win32';

/**
 * Runs a command and exits the process on failure.
 *
 * @param {string} command - Executable to run.
 * @param {string[]} args - Arguments.
 * @param {string} [cwd] - Working directory (defaults to repo root).
 */
function run(command, args, cwd = repoRoot) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: useShell,
    env: process.env
  });
  if (result.error) {
    console.error(result.error);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

/**
 * Runs a pnpm filter script and exits the process on failure.
 *
 * @param {string} filter - pnpm `--filter` package name.
 * @param {string} script - Package script name to run.
 */
function runFilter(filter, script) {
  run('pnpm', ['--filter', filter, script]);
}

/**
 * Runs a node script and exits the process on failure.
 *
 * @param {string} scriptPath - Absolute path to the script.
 */
function runNode(scriptPath) {
  run(process.execPath, [scriptPath]);
}

runFilter('@harborclient/core', 'build');
runFilter('@harborclient/storage-sqlite', 'build');
runFilter('@harborclient/cli', 'build');
runFilter('@harborclient/gui', 'build');

// Rebuild natives for Electron before copying — tests may leave the Node ABI.
runNode(join(repoRoot, 'scripts', 'install-app-deps.mjs'));
runNode(join(repoRoot, 'apps', 'cli', 'scripts', 'prepare-runtime-deps.mjs'));
