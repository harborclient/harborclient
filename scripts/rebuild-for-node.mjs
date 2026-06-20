import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nativeModules = ['better-sqlite3']

console.log(`Rebuilding native modules for Node ${process.version}...`)

const result = spawnSync('pnpm', ['rebuild', ...nativeModules], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: process.env
})

if (result.status !== 0) {
  console.error('Failed to rebuild native modules for Node')
  process.exit(result.status ?? 1)
}
