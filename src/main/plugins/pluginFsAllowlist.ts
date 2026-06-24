import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, normalize, resolve } from 'path';

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
    const normalized = normalizePath(targetPath);
    const paths = this.#pathsByPlugin.get(pluginId) ?? new Set<string>();
    paths.add(normalized);
    this.#pathsByPlugin.set(pluginId, paths);
  }

  /**
   * Returns whether a path is within the plugin allowlist.
   *
   * @param pluginId - Plugin manifest id.
   * @param targetPath - Path to validate.
   */
  isAllowed(pluginId: string, targetPath: string): boolean {
    const normalized = normalizePath(targetPath);
    const paths = this.#pathsByPlugin.get(pluginId);
    if (!paths) {
      return false;
    }
    for (const allowed of paths) {
      if (normalized === allowed || normalized.startsWith(`${allowed}/`)) {
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
  const resolved = resolve(targetPath);
  const normalized = normalize(resolved);
  if (normalized.includes('..')) {
    throw new Error(`Invalid path: ${targetPath}`);
  }
  return normalized;
}
