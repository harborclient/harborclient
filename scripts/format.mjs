#!/usr/bin/env node
/**
 * Formats (or checks formatting for) the monorepo efficiently.
 *
 * Root Prettier excludes `packages/sdk` (see `.prettierignore`) because the SDK
 * uses import-sort and Tailwind plugins. Those two passes run in parallel with
 * incremental `--cache`, then GUI dependency ordering is applied or verified.
 */
import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sdkDir = path.join(repoRoot, 'packages/sdk')
const checkMode = process.argv.includes('--check')
const prettierModeFlag = checkMode ? '--check' : '--write'
const rootCache = path.join(repoRoot, '.prettier-cache/root')
const sdkCache = path.join(repoRoot, '.prettier-cache/sdk')

/**
 * Runs Prettier in a package directory with a dedicated cache file.
 *
 * @param {string} name Label used when reporting failures.
 * @param {string} cwd Working directory for the Prettier invocation.
 * @param {string} cacheLocation Path passed to `--cache-location`.
 * @returns {Promise<{ name: string, status: number }>} Resolves with the exit status (never rejects).
 */
function runPrettier(name, cwd, cacheLocation) {
  return new Promise((resolve) => {
    const args = [
      'exec',
      'prettier',
      prettierModeFlag,
      '--cache',
      '--cache-location',
      cacheLocation,
      '.'
    ]
    const child = spawn('pnpm', args, { cwd, stdio: 'inherit', env: process.env })
    child.on('close', (status) => resolve({ name, status: status ?? 1 }))
    child.on('error', () => resolve({ name, status: 1 }))
  })
}

console.log(checkMode ? 'Checking formatting...' : 'Formatting...')

const results = await Promise.all([
  runPrettier('root', repoRoot, rootCache),
  runPrettier('sdk', sdkDir, sdkCache)
])

const failures = results.filter((result) => result.status !== 0)
if (failures.length > 0) {
  console.error(`format: failed steps: ${failures.map((failure) => failure.name).join(', ')}`)
  process.exit(1)
}

const sortMode = checkMode ? '--check' : '--write'
const sortStatus = spawnSync('node', ['scripts/sort-priority-deps.mjs', sortMode], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: process.env
}).status

if (sortStatus !== 0) {
  process.exit(sortStatus ?? 1)
}

if (!checkMode) {
  const packageJsonStatus = spawnSync(
    'pnpm',
    [
      'exec',
      'prettier',
      '--write',
      '--cache',
      '--cache-location',
      rootCache,
      'apps/gui/package.json'
    ],
    { cwd: repoRoot, stdio: 'inherit', env: process.env }
  ).status

  if (packageJsonStatus !== 0) {
    process.exit(packageJsonStatus ?? 1)
  }
}

console.log(checkMode ? '\nformat:check passed' : '\nformat complete')
