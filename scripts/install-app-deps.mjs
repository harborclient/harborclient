import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const isDarwin = process.platform === 'darwin'

const require = getElectronRebuildRequire()
const { rebuild } = require('@electron/rebuild')
const electronVersion = require('electron/package.json').version

// Native modules compile against the platform's default toolchain: MSVC on
// Windows (VS 2022 on the windows-2022 runner) and the system compiler on
// Linux. macOS builds from source to stay ABI-compatible with Electron.
// Avoid useElectronClang: it downloads a Chromium clang toolchain from Google
// storage at install time, which is fragile and breaks the Windows build with
// "Failed to fetch a clang resource".
//
// force: true makes the rebuild ignore any cached/previously built artifact.
// Without it, @electron/rebuild can short-circuit and leave behind a binary
// compiled against a different Node/Electron ABI (e.g. after an Electron bump
// or switching Node versions), which then fails to load at runtime with
// ERR_DLOPEN_FAILED / "compiled against a different Node.js version".
await rebuild({
  buildPath: projectRoot,
  electronVersion,
  buildFromSource: isDarwin,
  force: true
})

function getElectronRebuildRequire() {
  const candidates = [
    path.join(projectRoot, 'node_modules/@electron/rebuild/package.json'),
    ...findPnpmElectronRebuildPackageJsons()
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return createRequire(candidate)
    }
  }

  throw new Error('Could not find @electron/rebuild')
}

function findPnpmElectronRebuildPackageJsons() {
  const pnpmDir = path.join(projectRoot, 'node_modules/.pnpm')
  if (!fs.existsSync(pnpmDir)) return []

  return fs
    .readdirSync(pnpmDir)
    .filter((entry) => entry.startsWith('@electron+rebuild@'))
    .map((entry) =>
      path.join(pnpmDir, entry, 'node_modules/@electron/rebuild/package.json')
    )
}
