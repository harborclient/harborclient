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
 * Runs a command and exits the process on failure.
 *
 * @param command - Executable to run.
 * @param args - Arguments.
 * @param cwd - Working directory.
 */
function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: false,
    env: process.env
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run('node', [join(scriptsDir, 'build.mjs')], productRoot);

run(
  'pnpm',
  [
    'exec',
    'electron-builder',
    'build',
    `--project=${guiRoot}`,
    `--config=${join(productRoot, 'electron-builder.yml')}`,
    `-c.extraMetadata.version=${version}`,
    ...process.argv.slice(2)
  ],
  productRoot
);
