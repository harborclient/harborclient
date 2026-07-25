#!/usr/bin/env node
/**
 * Builds product dependencies, then runs electron-builder against the GUI app
 * directory using the product config and product package version.
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const productRoot = join(scriptsDir, '..');
const guiRoot = join(productRoot, '..', 'gui');
const productPackage = JSON.parse(readFileSync(join(productRoot, 'package.json'), 'utf8'));
const version = productPackage.version;
/**
 * Absolute entitlements path for macOS codesign.
 *
 * electron-builder forwards `mac.entitlements` to `codesign` without resolving
 * it against `--project`. Relative paths therefore follow this script's cwd
 * (`apps/harborclient`), not `apps/gui`.
 */
const macEntitlements = join(guiRoot, 'build', 'entitlements.mac.plist');

/**
 * Whether child processes should run through a shell.
 *
 * Windows cannot spawn `pnpm.cmd` shims with `shell: false` (ENOENT).
 */
const useShell = process.platform === 'win32';

/**
 * Extra args for electron-builder from the CLI.
 *
 * pnpm may forward a literal `--` separator into `process.argv`; strip it so
 * electron-builder only sees real flags such as `--win` / `--publish`.
 */
const builderArgs = process.argv.slice(2).filter((arg) => arg !== '--');

/**
 * Runs a command and exits the process on failure.
 *
 * @param {string} command - Executable to run.
 * @param {string[]} args - Arguments.
 * @param {string} cwd - Working directory.
 */
function run(command, args, cwd) {
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

run(process.execPath, [join(scriptsDir, 'build.mjs')], productRoot);

run(
  'pnpm',
  [
    'exec',
    'electron-builder',
    'build',
    `--project=${guiRoot}`,
    `--config=${join(productRoot, 'electron-builder.yml')}`,
    `-c.extraMetadata.version=${version}`,
    `-c.mac.entitlements=${macEntitlements}`,
    `-c.mac.entitlementsInherit=${macEntitlements}`,
    ...builderArgs
  ],
  productRoot
);
