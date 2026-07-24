import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptsDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptsDir, '../apps/gui')

/**
 * Runs a command with cwd set to the GUI package root.
 *
 * @param {string} command
 * @param {string[]} args
 * @returns {number}
 */
function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env
  })
  return result.status ?? 1
}

/**
 * Rebuilds native modules for Electron so `pnpm dev`/`pnpm build` keep working.
 *
 * @returns {number}
 */
function restoreElectronBuild() {
  return run('node', [path.join(scriptsDir, 'install-app-deps.mjs')])
}

// Keep this orchestrator alive on Ctrl-C; the child receives the signal and
// exits, then we still restore the Electron build below.
process.on('SIGINT', () => {})
process.on('SIGTERM', () => {})

// Build native modules for the system Node that vitest uses.
const rebuildStatus = run('node', [path.join(scriptsDir, 'rebuild-for-node.mjs')])
if (rebuildStatus !== 0) {
  restoreElectronBuild()
  process.exit(rebuildStatus)
}

const testStatus = run('pnpm', ['exec', 'vitest', 'run'])

// Always restore, even when tests fail or are interrupted, so the dev app
// never ends up with modules built against the wrong Node ABI.
restoreElectronBuild()

process.exit(testStatus)
