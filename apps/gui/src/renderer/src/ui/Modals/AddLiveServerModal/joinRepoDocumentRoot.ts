/**
 * Builds a document-root path from a git repository path and optional subdirectory.
 *
 * @param repoPath - Absolute repository working-tree path.
 * @param subdir - Optional subdirectory under the repo (may be empty).
 * @returns Combined absolute path suitable for a live-server document root.
 */
export function joinRepoDocumentRoot(repoPath: string, subdir: string): string {
  const base = repoPath.trim().replace(/[/\\]+$/, '');
  const trimmedSubdir = subdir
    .trim()
    .replace(/^[/\\]+/, '')
    .replace(/[/\\]+$/, '');
  if (!trimmedSubdir) {
    return base;
  }
  const separator = base.includes('\\') && !base.includes('/') ? '\\' : '/';
  return `${base}${separator}${trimmedSubdir}`;
}
