import type { MenuItem } from '@harborclient/sdk/components';
import type { GitRequestFileStatus } from '#/shared/types';

/**
 * Builds the per-item Git submenu for request and markdown rows in git-backed collections.
 *
 * Shows a single enabled action based on whether the file is tracked in git: untracked
 * files offer Add (stage), tracked files offer Remove (unstage).
 *
 * @param isGitBacked - Whether the parent collection is backed by a git storage provider.
 * @param gitItemStatus - Per-item git status when the item has staged or unstaged changes.
 * @param onStageItem - Stages the item file for commit.
 * @param onUnstageItem - Unstages the item file.
 * @returns Menu groups to splice into a row actions menu, or an empty array when not git-backed.
 */
export function buildGitItemMenuGroups(
  isGitBacked: boolean,
  gitItemStatus: GitRequestFileStatus | undefined,
  onStageItem: () => void,
  onUnstageItem: () => void
): MenuItem[][] {
  if (!isGitBacked) {
    return [];
  }

  const action = gitItemStatus?.isUntracked
    ? { label: 'Add', onSelect: onStageItem }
    : { label: 'Remove', onSelect: onUnstageItem };

  return [
    [
      {
        label: 'Git',
        submenu: [[action]]
      }
    ]
  ];
}
