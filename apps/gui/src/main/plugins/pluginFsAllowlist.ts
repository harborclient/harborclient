import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'fs';
import { basename, dirname, join, normalize, resolve } from 'path';
import { pathHasParentSegment } from '#/main/pathHasParentSegment';

/**
 * Tracks filesystem paths a plugin is allowed to read or write.
 */
export class PluginFsAllowlist {
  readonly #pathsByPlugin = new Map<string, Set<string>>();

  /**
   * Seeds the allowlist with a plugin package directory.
   *
   * @param pluginId - Plugin manifest id.
   * @param pluginDirectory - Absolute plugin root path.
   */
  seedPluginDirectory(pluginId: string, pluginDirectory: string): void {
    this.grantPath(pluginId, pluginDirectory);
  }

  /**
   * Removes all granted paths for one plugin.
   *
   * @param pluginId - Plugin manifest id.
   */
  clearPlugin(pluginId: string): void {
    this.#pathsByPlugin.delete(pluginId);
  }

  /**
   * Grants read/write access to one normalized absolute path.
   *
   * @param pluginId - Plugin manifest id.
   * @param targetPath - Absolute or relative path to allow.
   */
  grantPath(pluginId: string, targetPath: string): void {
    const resolved = resolveRealPath(targetPath);
    const paths = this.#pathsByPlugin.get(pluginId) ?? new Set<string>();
    paths.add(resolved);
    this.#pathsByPlugin.set(pluginId, paths);
  }

  /**
   * Returns whether a path is within the plugin allowlist.
   *
   * @param pluginId - Plugin manifest id.
   * @param targetPath - Path to validate.
   */
  isAllowed(pluginId: string, targetPath: string): boolean {
    const resolved = resolveRealPath(targetPath);
    const paths = this.#pathsByPlugin.get(pluginId);
    if (!paths) {
      return false;
    }
    for (const allowed of paths) {
      if (resolved === allowed || resolved.startsWith(`${allowed}/`)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Reads a UTF-8 text file when the path is allowlisted.
   *
   * @param pluginId - Plugin manifest id.
   * @param targetPath - Absolute file path.
   */
  readTextFile(pluginId: string, targetPath: string): string {
    this.assertAllowed(pluginId, targetPath);
    return readFileSync(normalizePath(targetPath), 'utf-8');
  }

  /**
   * Writes a UTF-8 text file when the path is allowlisted.
   *
   * @param pluginId - Plugin manifest id.
   * @param targetPath - Absolute file path.
   * @param content - UTF-8 content to write.
   */
  writeTextFile(pluginId: string, targetPath: string, content: string): void {
    this.assertAllowed(pluginId, targetPath);
    const normalized = normalizePath(targetPath);
    mkdirSync(dirname(normalized), { recursive: true });
    writeFileSync(normalized, content, 'utf-8');
  }

  /**
   * Throws when a path is outside the plugin allowlist.
   *
   * @param pluginId - Plugin manifest id.
   * @param targetPath - Path to validate.
   */
  assertAllowed(pluginId: string, targetPath: string): void {
    if (!this.isAllowed(pluginId, targetPath)) {
      throw new Error(`Path is not allowlisted for plugin ${pluginId}: ${targetPath}`);
    }
  }
}

/**
 * Normalizes a filesystem path to an absolute, slash-safe form.
 *
 * @param targetPath - Path to normalize.
 */
export function normalizePath(targetPath: string): string {
  if (pathHasParentSegment(targetPath)) {
    throw new Error(`Invalid path: ${targetPath}`);
  }
  const resolved = resolve(targetPath);
  return normalize(resolved);
}

/**
 * Resolves a filesystem path to its canonical form, following symlinks.
 *
 * When the final path component does not exist yet, resolves the nearest
 * existing ancestor and appends the remaining segments so write-before-create
 * checks still work.
 *
 * @param targetPath - Path to resolve.
 */
export function resolveRealPath(targetPath: string): string {
  const normalized = normalizePath(targetPath);
  try {
    return realpathSync(normalized);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      throw error;
    }
    const parent = dirname(normalized);
    if (parent === normalized) {
      return normalized;
    }
    return join(resolveRealPath(parent), basename(normalized));
  }
}
