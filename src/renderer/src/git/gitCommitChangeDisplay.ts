import type { GitCommitChangeStatus } from '#/shared/types';

/**
 * Tailwind text color class for one commit change status.
 *
 * @param status - Added, modified, or deleted relative to the parent commit.
 */
export function gitCommitChangeNameClass(status: GitCommitChangeStatus): string {
  switch (status) {
    case 'added':
      return 'text-git-unstaged';
    case 'modified':
      return 'text-git-uncommitted';
    case 'deleted':
      return 'text-muted line-through';
    default:
      return '';
  }
}

/**
 * Human-readable commit change suffix for accessible file row names.
 *
 * @param status - Added, modified, or deleted relative to the parent commit.
 */
export function gitCommitChangeAccessibleLabel(status: GitCommitChangeStatus): string {
  switch (status) {
    case 'added':
      return 'added in commit';
    case 'modified':
      return 'modified in commit';
    case 'deleted':
      return 'deleted in commit';
    default:
      return 'changed in commit';
  }
}

/**
 * Builds an accessible name for a commit file row button.
 *
 * @param filePath - Repository-relative path under the HarborClient tree.
 * @param status - Commit change status for the file.
 */
export function buildGitCommitFileAccessibleName(
  filePath: string,
  status: GitCommitChangeStatus
): string {
  return `${filePath}, ${gitCommitChangeAccessibleLabel(status)}`;
}
