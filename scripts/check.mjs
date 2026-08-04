#!/usr/bin/env node
/**
 * Runs the full pre-merge check suite with a single SDK build.
 *
 * `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, and `pnpm test` are
 * independent, but running them one after another rebuilds the SDK twice
 * (typecheck and test both need its dist output) and leaves cores idle.
 * This orchestrator builds the SDK and shortcut-runner once, then runs all
 * four checks in parallel and reports every failure instead of stopping at
 * the first.
 *
 * Test execution goes through `test:packages`, which keeps the GUI suite
 * (and its native-module ABI rebuild) sequential after the other packages.
 */
import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Runs a pnpm script asynchronously with output streamed to the console.
 *
 * @param {string} name Label used when reporting failures.
 * @param {string[]} args Arguments passed to `pnpm`.
 * @returns {Promise<{ name: string, status: number }>} Resolves with the exit status (never rejects).
 */
function runParallel(name, args) {
  return new Promise((resolve) => {
    const child = spawn('pnpm', args, { cwd: repoRoot, stdio: 'inherit', env: process.env })
    child.on('close', (status) => resolve({ name, status: status ?? 1 }))
    child.on('error', () => resolve({ name, status: 1 }))
  })
}

console.log('Building SDK...')
const buildStatus = spawnSync('pnpm', ['build:sdk'], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: process.env
}).status

if (buildStatus !== 0) {
  console.error('check: build:sdk failed')
  process.exit(buildStatus ?? 1)
}

console.log('Building shortcut-runner...')
const shortcutRunnerBuildStatus = spawnSync('pnpm', ['build:shortcut-runner'], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: process.env
}).status

if (shortcutRunnerBuildStatus !== 0) {
  console.error('check: build:shortcut-runner failed')
  process.exit(shortcutRunnerBuildStatus ?? 1)
}

console.log('Running lint, format:check, typecheck, and tests in parallel...')
const results = await Promise.all([
  runParallel('lint', ['lint']),
  runParallel('format:check', ['format:check']),
  // typecheck:packages / test:packages skip the SDK build already done above.
  runParallel('typecheck', ['typecheck:packages']),
  runParallel('test', ['test:packages'])
])

const failures = results.filter((result) => result.status !== 0)
if (failures.length > 0) {
  console.error(`\ncheck: failed steps: ${failures.map((failure) => failure.name).join(', ')}`)
  process.exit(1)
}

console.log('\ncheck: all steps passed')
