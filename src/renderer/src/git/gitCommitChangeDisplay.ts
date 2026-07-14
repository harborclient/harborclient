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
 * Returns a short resource-kind label for git sidebar rows.
 *
 * @param resourceKind - Request or document discriminator when known.
 */
export function gitResourceKindLabel(resourceKind?: 'request' | 'document'): string | null {
  if (resourceKind === 'request') {
    return 'request';
  }
  if (resourceKind === 'document') {
    return 'document';
  }
  return null;
}

/**
 * Resolves the primary label for one git change row.
 *
 * @param filePath - Repository-relative path under the HarborClient tree.
 * @param displayName - Optional user-facing request or document name.
 */
export function resolveGitChangeDisplayLabel(filePath: string, displayName?: string): string {
  return displayName?.trim() || filePath;
}

/**
 * Builds an accessible name for a commit file row button.
 *
 * @param filePath - Repository-relative path under the HarborClient tree.
 * @param status - Commit change status for the file.
 * @param displayName - Optional user-facing request or document name.
 * @param resourceKind - Optional HarborClient resource kind.
 */
export function buildGitCommitFileAccessibleName(
  filePath: string,
  status: GitCommitChangeStatus,
  displayName?: string,
  resourceKind?: 'request' | 'document'
): string {
  const label = resolveGitChangeDisplayLabel(filePath, displayName);
  const kindLabel = gitResourceKindLabel(resourceKind);
  const kindSuffix = kindLabel != null ? `, ${kindLabel}` : '';
  return `${label}${kindSuffix}, ${gitCommitChangeAccessibleLabel(status)}`;
}
