import { realpathSync } from 'fs';
import { basename, dirname, isAbsolute, join, normalize, resolve, sep } from 'path';
import { pathHasParentSegment } from '#/main/pathHasParentSegment';

/**
 * Resolved repository-relative path confined to a git working tree.
 */
export interface ResolvedRepoRelativePath {
  /**
   * Forward-slash relative path suitable for isomorphic-git APIs.
   */
  relative: string;
  /**
   * Absolute filesystem path after realpath confinement under the repo root.
   */
  absolute: string;
}

/**
 * Returns whether a path string is absolute after unifying separators.
 *
 * Detects POSIX absolute paths, Windows drive letters, and UNC prefixes so
 * renderer-supplied strings cannot bypass repository confinement.
 *
 * @param targetPath - Path to inspect (may use `/` or `\`).
 * @returns True when the path is absolute on the current or a foreign platform.
 */
export function isAbsoluteRepoPath(targetPath: string): boolean {
  const unified = targetPath.replace(/\\/g, '/');
  if (isAbsolute(targetPath) || isAbsolute(unified)) {
    return true;
  }
  if (/^[a-zA-Z]:\//.test(unified)) {
    return true;
  }
  if (unified.startsWith('//')) {
    return true;
  }
  return false;
}

/**
 * Returns whether a repository-relative path targets the `.git` directory.
 *
 * @param relativePath - Forward-slash relative path.
 * @returns True when the first segment is `.git`.
 */
export function isGitDirectoryPath(relativePath: string): boolean {
  const first = relativePath
    .replace(/\\/g, '/')
    .split('/')
    .find((segment) => segment.length > 0);
  return first === '.git';
}

/**
 * Resolves a filesystem path to its canonical form, following symlinks.
 *
 * When the final path component does not exist yet, resolves the nearest
 * existing ancestor and appends the remaining segments so write-before-create
 * checks still work.
 *
 * @param targetPath - Absolute path to resolve.
 * @returns Canonical absolute path.
 */
function resolveExistingRealPath(targetPath: string): string {
  const normalized = normalize(resolve(targetPath));
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
    return join(resolveExistingRealPath(parent), basename(normalized));
  }
}

/**
 * Returns whether a candidate absolute path is equal to or nested under a root.
 *
 * @param rootResolved - Absolute resolved directory root.
 * @param candidateResolved - Absolute resolved candidate path.
 * @returns True when the candidate is the root or a descendant of it.
 */
function isPathUnderRoot(rootResolved: string, candidateResolved: string): boolean {
  if (candidateResolved === rootResolved) {
    return true;
  }
  const prefix = rootResolved.endsWith(sep) ? rootResolved : `${rootResolved}${sep}`;
  return candidateResolved.startsWith(prefix);
}

/**
 * Confines a repository-relative path to a git working-tree root.
 *
 * Rejects empty input, absolute paths, parent-directory segments, `.git`
 * paths, and symlink escapes outside the repository.
 *
 * @param repoDir - Absolute repository root used as isomorphic-git dir.
 * @param filepath - Path relative to the repository root.
 * @returns Relative path for git APIs and absolute path for direct fs access.
 * @throws When the path is empty, escapes the repository, or targets `.git`.
 */
export function resolveRepoRelativePath(
  repoDir: string,
  filepath: string
): ResolvedRepoRelativePath {
  const trimmed = filepath.trim();
  if (!trimmed) {
    throw new Error('File path is required.');
  }

  if (isAbsoluteRepoPath(trimmed) || pathHasParentSegment(trimmed) || isGitDirectoryPath(trimmed)) {
    throw new Error(`Invalid repository file path: ${trimmed}`);
  }

  const relative = trimmed.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!relative || isAbsoluteRepoPath(relative) || pathHasParentSegment(relative)) {
    throw new Error(`Invalid repository file path: ${trimmed}`);
  }
  if (isGitDirectoryPath(relative)) {
    throw new Error(`Invalid repository file path: ${trimmed}`);
  }

  const repoRoot = resolveExistingRealPath(repoDir);
  const joined = resolve(repoRoot, relative);
  if (!isPathUnderRoot(repoRoot, joined)) {
    throw new Error(`Invalid repository file path: ${trimmed}`);
  }

  const absolute = resolveExistingRealPath(joined);
  if (!isPathUnderRoot(repoRoot, absolute)) {
    throw new Error(`Invalid repository file path: ${trimmed}`);
  }

  return { relative, absolute };
}
