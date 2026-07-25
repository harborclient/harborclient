#!/usr/bin/env node
/**
 * Copies native CLI runtime dependencies into `dist/node_modules` for packaging.
 *
 * The CLI bundle leaves `better-sqlite3` and `esbuild` external. Packaged installs
 * place `resources/cli/index.js` outside the app asar, so those packages must sit
 * beside the entry. Prefer the Electron-rebuilt copies from `@harborclient/gui`
 * (via `scripts/install-app-deps.mjs`) so `ELECTRON_RUN_AS_NODE` can load them.
 *
 * Production dependency trees are copied recursively (for example `bindings` for
 * better-sqlite3). Install-only packages such as `prebuild-install` are skipped.
 * After copy, better-sqlite3 compile intermediates (`obj.target`, `.o`, sources)
 * are pruned so macOS codesign does not attempt to sign non-Mach-O objects.
 */
import { createRequire } from 'node:module';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(scriptDir, '..');
const guiRoot = join(packageRoot, '..', 'gui');
const outNodeModules = join(packageRoot, 'dist', 'node_modules');

/**
 * Packages used only at install/build time — not required when the CLI loads
 * native addons at runtime under Electron.
 */
const SKIP_RUNTIME_DEPS = new Set(['prebuild-install']);

/**
 * Directories under a native package that are compile-time only.
 *
 * Shipping `obj.target` (and similar) into `extraResources` makes macOS
 * codesign try to sign intermediate `.o` files, which fails with
 * "cannot read entitlement data".
 */
const NATIVE_BUILD_JUNK_DIRS = new Set(['obj.target', 'obj', '.deps']);

/**
 * Top-level better-sqlite3 paths needed only to compile the addon, not to load
 * the Electron-rebuilt `build/Release/*.node` at runtime.
 */
const BETTER_SQLITE3_SOURCE_PATHS = ['src', 'deps', 'binding.gyp', 'bin'];

/**
 * Maps Node's `process.platform` / `process.arch` to an `@esbuild/*` package name.
 *
 * Matches esbuild's published optional-dependency naming (see esbuild install.js).
 *
 * @returns {string} Scoped package name such as `@esbuild/linux-x64`.
 * @throws {Error} When the current platform/arch has no known esbuild binary package.
 */
function esbuildPlatformPackage() {
  const { platform, arch } = process;
  if (platform === 'darwin' && arch === 'arm64') return '@esbuild/darwin-arm64';
  if (platform === 'darwin' && arch === 'x64') return '@esbuild/darwin-x64';
  if (platform === 'linux' && arch === 'arm64') return '@esbuild/linux-arm64';
  if (platform === 'linux' && arch === 'arm') return '@esbuild/linux-arm';
  if (platform === 'linux' && arch === 'x64') return '@esbuild/linux-x64';
  if (platform === 'linux' && arch === 'ia32') return '@esbuild/linux-ia32';
  if (platform === 'linux' && arch === 'ppc64') return '@esbuild/linux-ppc64';
  if (platform === 'linux' && arch === 's390x') return '@esbuild/linux-s390x';
  if (platform === 'win32' && arch === 'arm64') return '@esbuild/win32-arm64';
  if (platform === 'win32' && arch === 'ia32') return '@esbuild/win32-ia32';
  if (platform === 'win32' && arch === 'x64') return '@esbuild/win32-x64';
  if (platform === 'freebsd' && arch === 'arm64') return '@esbuild/freebsd-arm64';
  if (platform === 'freebsd' && arch === 'x64') return '@esbuild/freebsd-x64';
  if (platform === 'netbsd' && arch === 'arm64') return '@esbuild/netbsd-arm64';
  if (platform === 'netbsd' && arch === 'x64') return '@esbuild/netbsd-x64';
  if (platform === 'openbsd' && arch === 'arm64') return '@esbuild/openbsd-arm64';
  if (platform === 'openbsd' && arch === 'x64') return '@esbuild/openbsd-x64';
  if (platform === 'sunos' && arch === 'x64') return '@esbuild/sunos-x64';
  if (platform === 'aix' && arch === 'ppc64') return '@esbuild/aix-ppc64';
  if (platform === 'android' && arch === 'arm64') return '@esbuild/android-arm64';
  if (platform === 'android' && arch === 'arm') return '@esbuild/android-arm';
  if (platform === 'android' && arch === 'x64') return '@esbuild/android-x64';
  throw new Error(`Unsupported esbuild platform: ${platform}/${arch}`);
}

/**
 * Resolves a package directory to a real filesystem path (follows pnpm symlinks).
 *
 * @param {NodeJS.Require} requireFrom - createRequire bound to a package that can see the dependency.
 * @param {string} packageName - Bare package name to resolve.
 * @returns {string} Absolute path to the package root directory.
 */
function resolvePackageDir(requireFrom, packageName) {
  const pkgJson = requireFrom.resolve(`${packageName}/package.json`);
  return dirname(pkgJson);
}

/**
 * Copies a dependency package tree into `dist/node_modules`, dereferencing symlinks.
 *
 * @param {string} sourceDir - Absolute path to the installed package root.
 * @param {string} packageName - Destination package name (may include a scope).
 */
function copyPackage(sourceDir, packageName) {
  const destDir = join(outNodeModules, packageName);
  mkdirSync(dirname(destDir), { recursive: true });
  rmSync(destDir, { recursive: true, force: true });
  cpSync(sourceDir, destDir, { recursive: true, dereference: true });
}

/**
 * Copies a package and its production dependency tree into `dist/node_modules`.
 *
 * @param {NodeJS.Require} requireFrom - Resolver that can see `packageName`.
 * @param {string} packageName - Package to copy.
 * @param {Set<string>} visited - Packages already copied (cycle guard).
 */
function copyPackageWithDeps(requireFrom, packageName, visited = new Set()) {
  if (visited.has(packageName) || SKIP_RUNTIME_DEPS.has(packageName)) {
    return;
  }
  visited.add(packageName);

  const sourceDir = resolvePackageDir(requireFrom, packageName);
  copyPackage(sourceDir, packageName);

  const pkg = JSON.parse(readFileSync(join(sourceDir, 'package.json'), 'utf8'));
  const deps = Object.keys(pkg.dependencies ?? {});
  const nestedRequire = createRequire(join(sourceDir, 'package.json'));
  for (const dep of deps) {
    try {
      copyPackageWithDeps(nestedRequire, dep, visited);
    } catch (err) {
      if (SKIP_RUNTIME_DEPS.has(dep)) {
        continue;
      }
      throw err;
    }
  }
}

/**
 * Deletes a path when present (file or directory).
 *
 * @param {string} targetPath - Absolute path to remove.
 */
function removeIfExists(targetPath) {
  rmSync(targetPath, { recursive: true, force: true });
}

/**
 * Strips node-gyp intermediates from a package's `build/Release` tree.
 *
 * Keeps runtime loadables such as `*.node` while removing object files, static
 * archives, and dependency stamp directories that must not be codesigned.
 *
 * @param {string} packageDir - Absolute path to the copied package root.
 */
function pruneReleaseBuildJunk(packageDir) {
  const releaseDir = join(packageDir, 'build', 'Release');
  if (!existsSync(releaseDir)) {
    return;
  }

  for (const entry of readdirSync(releaseDir)) {
    const fullPath = join(releaseDir, entry);
    if (NATIVE_BUILD_JUNK_DIRS.has(entry)) {
      removeIfExists(fullPath);
      continue;
    }
    if (!statSync(fullPath).isFile()) {
      continue;
    }
    if (entry.endsWith('.o') || entry.endsWith('.a') || entry.endsWith('.lib')) {
      removeIfExists(fullPath);
      continue;
    }
    // Test addon built beside the real binding; never loaded by the CLI.
    if (entry === 'test_extension.node') {
      removeIfExists(fullPath);
    }
  }
}

/**
 * Removes compile-only better-sqlite3 files so packaged `cli/node_modules` only
 * contains what `bindings` needs to load `better_sqlite3.node`.
 *
 * @param {string} packageDir - Absolute path to the copied better-sqlite3 root.
 */
function pruneBetterSqlite3Package(packageDir) {
  pruneReleaseBuildJunk(packageDir);

  for (const relativePath of BETTER_SQLITE3_SOURCE_PATHS) {
    removeIfExists(join(packageDir, relativePath));
  }

  const buildDir = join(packageDir, 'build');
  if (!existsSync(buildDir)) {
    return;
  }
  for (const entry of readdirSync(buildDir)) {
    if (entry === 'Release') {
      continue;
    }
    // Makefiles, gyp config, and nested deps/ are compile-time only.
    removeIfExists(join(buildDir, entry));
  }
}

if (!existsSync(join(guiRoot, 'package.json'))) {
  console.error(`GUI package not found at ${guiRoot}`);
  process.exit(1);
}

const guiRequire = createRequire(join(guiRoot, 'package.json'));
const esbuildPkgJson = guiRequire.resolve('esbuild/package.json');
const esbuildRequire = createRequire(esbuildPkgJson);
const platformPackage = esbuildPlatformPackage();

rmSync(outNodeModules, { recursive: true, force: true });
mkdirSync(outNodeModules, { recursive: true });

const visited = new Set();
copyPackageWithDeps(guiRequire, 'better-sqlite3', visited);
copyPackageWithDeps(guiRequire, 'esbuild', visited);
copyPackageWithDeps(esbuildRequire, platformPackage, visited);

pruneBetterSqlite3Package(join(outNodeModules, 'better-sqlite3'));

console.log(`Prepared CLI runtime deps in ${outNodeModules}`);
for (const name of [...visited].sort()) {
  console.log(`  ${name}`);
}
