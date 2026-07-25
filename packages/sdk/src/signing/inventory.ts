import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { PLUGIN_SIGNATURE_FILENAME } from './types.js';
import type { PluginFileHash } from './types.js';

const EXCLUDED_PATH_SEGMENTS = new Set(['.git', 'node_modules']);
const EXCLUDED_FILE_NAMES = new Set(['.DS_Store', PLUGIN_SIGNATURE_FILENAME]);

/**
 * Returns true when a relative plugin path should be excluded from signing.
 *
 * @param relativePath - Path relative to the plugin root using POSIX separators.
 */
export function shouldExcludePluginPath(relativePath: string): boolean {
  const segments = relativePath.split('/');
  if (segments.some((segment) => EXCLUDED_PATH_SEGMENTS.has(segment))) {
    return true;
  }
  const fileName = segments.at(-1);
  return fileName != null && EXCLUDED_FILE_NAMES.has(fileName);
}

/**
 * Computes a SHA-256 hex digest for one file.
 *
 * @param absolutePath - Absolute path to the file on disk.
 */
function hashFile(absolutePath: string): string {
  return createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
}

/**
 * Walks a plugin directory and returns a sorted inventory of file hashes.
 *
 * @param pluginDir - Plugin root directory.
 * @returns File paths (POSIX) and SHA-256 digests sorted by path.
 */
export function collectPluginFiles(pluginDir: string): PluginFileHash[] {
  const files: PluginFileHash[] = [];

  /**
   * Recursively collects file hashes under one directory.
   *
   * @param currentDir - Absolute directory being scanned.
   */
  function walk(currentDir: string): void {
    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = join(currentDir, entry.name);
      const relativePath = relative(pluginDir, absolutePath).split('\\').join('/');

      if (shouldExcludePluginPath(relativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      files.push({
        path: relativePath,
        sha256: hashFile(absolutePath)
      });
    }
  }

  walk(pluginDir);
  files.sort((left, right) => left.path.localeCompare(right.path));
  return files;
}

/**
 * Returns true when a plugin path exists and is a directory.
 *
 * @param pluginDir - Plugin root directory.
 */
export function assertPluginDirectory(pluginDir: string): void {
  try {
    const stats = statSync(pluginDir);
    if (!stats.isDirectory()) {
      throw new Error(`Plugin directory is not a folder: ${pluginDir}`);
    }
  } catch (error) {
    throw new Error(`Plugin directory not found: ${pluginDir}`, { cause: error });
  }
}
