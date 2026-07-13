import type { GitCommitFileChange, GitCommitPlainFileChange } from '#/shared/types';

/**
 * Flat commit file rows for rendering in the commit details modal.
 */
export interface GitCommitChangesViewModel {
  /**
   * HarborClient file paths changed in the commit, sorted by path.
   */
  files: GitCommitPlainFileChange[];
}

/**
 * Filters enriched commit file changes down to plain file rows for display.
 *
 * Request and document resource groupings are omitted because collection storage
 * is flattened to single JSON files per collection.
 *
 * @param files - Commit file changes returned by `gitCommitDetail`.
 * @returns View-model rows for file-path rendering.
 */
export function buildGitCommitChangesViewModel(
  files: GitCommitFileChange[]
): GitCommitChangesViewModel {
  return {
    files: files
      .filter((file): file is GitCommitPlainFileChange => file.kind === 'file')
      .sort((a, b) => a.path.localeCompare(b.path))
  };
}
