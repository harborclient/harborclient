import type { GitRequestDisplayStatus } from '#/shared/types';

/**
 * Tailwind text color class for a git-backed request display status.
 *
 * @param status - Request git display status, or undefined when clean/unknown.
 */
export function gitRequestNameClass(status: GitRequestDisplayStatus | undefined): string {
  switch (status) {
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
 * Human-readable git status suffix for accessible request row names.
 *
 * @param status - Request git display status, or undefined when clean/unknown.
 */
export function gitRequestStatusAccessibleLabel(
  status: GitRequestDisplayStatus | undefined
): string | null {
  switch (status) {
    case 'staged':
      return 'staged for commit';
    case 'uncommitted':
      return 'modified, not staged';
    case 'unstaged':
      return 'not added to git';
    default:
      return null;
  }
}

/**
 * Builds an accessible name for a git-backed request row button.
 *
 * @param requestName - Display name of the request.
 * @param status - Request git display status, when known.
 */
export function buildGitRequestAccessibleName(
  requestName: string,
  status: GitRequestDisplayStatus | undefined
): string {
  const statusLabel = gitRequestStatusAccessibleLabel(status);
  return statusLabel != null ? `${requestName}, ${statusLabel}` : requestName;
}
