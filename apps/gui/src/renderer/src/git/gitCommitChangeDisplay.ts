import type { GitCommitChangeStatus, GitRequestFileStatus } from '#/shared/types';

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
 * Single-letter git change status marker for compact sidebar rows.
 *
 * @param status - Added, modified, or deleted relative to HEAD.
 * @param hasConflict - Whether the file has unresolved merge conflict markers.
 */
export function gitChangeStatusMarker(
  status: GitCommitChangeStatus,
  hasConflict: boolean
): 'A' | 'M' | 'D' | 'C' {
  if (hasConflict) {
    return 'C';
  }
  switch (status) {
    case 'added':
      return 'A';
    case 'modified':
      return 'M';
    case 'deleted':
      return 'D';
    default:
      return 'M';
  }
}

/**
 * Human-readable label for one compact git change status marker.
 *
 * @param status - Added, modified, or deleted relative to HEAD.
 * @param hasConflict - Whether the file has unresolved merge conflict markers.
 */
export function gitChangeStatusMarkerLabel(
  status: GitCommitChangeStatus,
  hasConflict: boolean
): 'Added' | 'Modified' | 'Deleted' | 'Conflict' {
  if (hasConflict) {
    return 'Conflict';
  }
  switch (status) {
    case 'added':
      return 'Added';
    case 'modified':
      return 'Modified';
    case 'deleted':
      return 'Deleted';
    default:
      return 'Modified';
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
 * @param resourceKind - Request, document, or collection discriminator when known.
 */
export function gitResourceKindLabel(
  resourceKind?: 'request' | 'document' | 'collection'
): string | null {
  if (resourceKind === 'request') {
    return 'request';
  }
  if (resourceKind === 'document') {
    return 'document';
  }
  if (resourceKind === 'collection') {
    return 'collection';
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
  resourceKind?: 'request' | 'document' | 'collection'
): string {
  const label = resolveGitChangeDisplayLabel(filePath, displayName);
  const kindLabel = gitResourceKindLabel(resourceKind);
  const kindSuffix = kindLabel != null ? `, ${kindLabel}` : '';
  return `${label}${kindSuffix}, ${gitCommitChangeAccessibleLabel(status)}`;
}

/**
 * Tailwind text color class for one git-backed collection item name.
 *
 * @param status - Per-item git status when the parent collection is git-backed.
 */
export function gitItemNameClass(status?: GitRequestFileStatus): string {
  if (status == null || status.displayStatus === 'clean') {
    return '';
  }
  if (status.isUntracked === true) {
    return 'text-git-untracked';
  }
  switch (status.displayStatus) {
    case 'staged':
      return 'text-git-staged';
    case 'uncommitted':
      return 'text-git-uncommitted';
    case 'unstaged':
      return 'text-git-unstaged';
    default:
      return '';
  }
}

/**
 * Accessible suffix for one git-backed collection item row when status is not conveyed by color alone.
 *
 * @param status - Per-item git status when the parent collection is git-backed.
 */
export function gitItemAccessibleSuffix(status?: GitRequestFileStatus): string | null {
  if (status?.isUntracked === true) {
    return 'not added to git';
  }
  return null;
}

/**
 * Builds an accessible name for a git-backed collection item row button.
 *
 * @param name - User-facing request or document name.
 * @param status - Per-item git status when the parent collection is git-backed.
 */
export function buildGitItemAccessibleName(name: string, status?: GitRequestFileStatus): string {
  const suffix = gitItemAccessibleSuffix(status);
  return suffix != null ? `${name}, ${suffix}` : name;
}
