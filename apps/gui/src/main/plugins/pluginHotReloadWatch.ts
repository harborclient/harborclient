import { existsSync, readFileSync } from 'fs';
import { dirname, join, normalize, relative, resolve } from 'path';
import type { PluginManifest, PluginScreenshot } from '#/shared/plugin/types';

const MANIFEST_FILENAME = 'manifest.json';

const STYLESHEET_REF_PATTERN = /stylesheet:\s*['"]([^'"]+)['"]/g;

/**
 * File and directory paths to watch for unpacked plugin hot reload.
 */
export interface PluginHotReloadWatchTargets {
  files: string[];
  directories: string[];
}

/**
 * Resolves a path relative to a root directory and rejects traversal outside it.
 *
 * @param rootDir - Absolute directory that must contain the resolved path.
 * @param relativePath - Path relative to the root directory.
 * @returns Absolute resolved path within rootDir.
 */
function resolvePathWithinRoot(rootDir: string, relativePath: string): string {
  const normalizedRoot = resolve(rootDir);
  const absolutePath = resolve(normalizedRoot, relativePath);
  const rel = relative(normalizedRoot, absolutePath);
  if (rel.startsWith('..') || rel.includes(`..${normalize('/')}`)) {
    throw new Error(`Plugin asset path escapes plugin directory: ${relativePath}`);
  }
  return absolutePath;
}

/**
 * Resolves a plugin-relative path when safe, otherwise returns null.
 *
 * @param rootDir - Absolute plugin root directory.
 * @param relativePath - Path relative to the plugin root.
 */
function tryResolvePath(rootDir: string, relativePath: string): string | null {
  try {
    return resolvePathWithinRoot(rootDir, relativePath);
  } catch {
    return null;
  }
}

/**
 * Returns the asset path from a manifest screenshot entry.
 *
 * @param screenshot - Manifest screenshot string or object.
 */
function screenshotPath(screenshot: PluginScreenshot): string {
  return typeof screenshot === 'string' ? screenshot : screenshot.path;
}

/**
 * Collects manifest-relative asset paths that affect hot reload.
 *
 * @param manifest - Parsed plugin manifest.
 */
function manifestAssetRelativePaths(manifest: PluginManifest): string[] {
  const paths: string[] = [];
  if (manifest.renderer) {
    paths.push(manifest.renderer);
  }
  if (manifest.main) {
    paths.push(manifest.main);
  }
  if (manifest.description) {
    paths.push(manifest.description);
  }
  if (manifest.icon) {
    paths.push(manifest.icon);
  }
  if (manifest.screenshots) {
    for (const screenshot of manifest.screenshots) {
      paths.push(screenshotPath(screenshot));
    }
  }
  return paths;
}

/**
 * Registers one resolved file path and its parent directory for watching.
 *
 * @param files - Accumulated file watch targets.
 * @param directories - Accumulated directory watch targets.
 * @param rootDir - Absolute plugin root directory.
 * @param relativePath - Plugin-relative asset path.
 */
function addWatchTarget(
  files: Set<string>,
  directories: Set<string>,
  rootDir: string,
  relativePath: string
): void {
  const absolute = tryResolvePath(rootDir, relativePath);
  if (!absolute) {
    return;
  }
  files.add(absolute);
  directories.add(dirname(absolute));
}

/**
 * Finds theme stylesheet paths referenced as string literals in an entry bundle.
 *
 * @param entryAbsolutePath - Absolute path to a renderer or main bundle.
 */
function stylesheetPathsFromEntry(entryAbsolutePath: string): string[] {
  if (!existsSync(entryAbsolutePath)) {
    return [];
  }
  const content = readFileSync(entryAbsolutePath, 'utf8');
  const paths: string[] = [];
  for (const match of content.matchAll(STYLESHEET_REF_PATTERN)) {
    const relativePath = match[1];
    if (relativePath) {
      paths.push(relativePath);
    }
  }
  return paths;
}

/**
 * Collects file and directory paths to watch for unpacked plugin hot reload.
 *
 * @param pluginRoot - Absolute plugin root directory.
 * @param manifest - Parsed plugin manifest.
 */
export function collectPluginHotReloadWatchTargets(
  pluginRoot: string,
  manifest: PluginManifest
): PluginHotReloadWatchTargets {
  const normalizedRoot = resolve(pluginRoot);
  const files = new Set<string>();
  const directories = new Set<string>();

  files.add(join(normalizedRoot, MANIFEST_FILENAME));
  directories.add(normalizedRoot);

  for (const relativePath of manifestAssetRelativePaths(manifest)) {
    addWatchTarget(files, directories, normalizedRoot, relativePath);
  }

  for (const entry of [manifest.renderer, manifest.main]) {
    if (!entry) {
      continue;
    }
    const entryAbsolute = tryResolvePath(normalizedRoot, entry) ?? join(normalizedRoot, entry);
    for (const stylesheetPath of stylesheetPathsFromEntry(entryAbsolute)) {
      addWatchTarget(files, directories, normalizedRoot, stylesheetPath);
    }
  }

  return {
    files: [...files].sort(),
    directories: [...directories].sort()
  };
}
