/**
 * Ensures the Electron binary is downloaded after pnpm install.
 *
 * In a pnpm workspace the electron package can land without `path.txt` /
 * `dist/` when the install lifecycle was skipped or the store copy was
 * incomplete, which makes electron-vite fail with "Electron uninstall".
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const requireFromGui = createRequire(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../apps/gui/package.json')
)

/**
 * Resolves the installed electron package directory.
 *
 * @returns Absolute path to the electron package root.
 */
function resolveElectronPackageDir() {
  return path.dirname(requireFromGui.resolve('electron/package.json'))
}

const electronDir = resolveElectronPackageDir()
const pathFile = path.join(electronDir, 'path.txt')
const installScript = path.join(electronDir, 'install.js')

if (fs.existsSync(pathFile)) {
  const relativeBinary = fs.readFileSync(pathFile, 'utf8').trim()
  const binaryPath = path.join(electronDir, 'dist', relativeBinary)
  if (fs.existsSync(binaryPath)) {
    process.exit(0)
  }
}

console.log('Electron binary missing; running electron/install.js…')
const result = spawnSync(process.execPath, [installScript], {
  cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../apps/gui'),
  stdio: 'inherit',
  env: process.env
})
process.exit(result.status ?? 1)
