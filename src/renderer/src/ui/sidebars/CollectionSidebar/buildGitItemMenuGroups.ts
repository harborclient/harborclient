import type { MenuItem } from '@harborclient/sdk/components';
import type { GitRequestFileStatus } from '#/shared/types';

/**
 * Builds the per-item Git submenu for request and markdown rows in git-backed collections.
 *
 * Shows a single Add (stage) or Remove (unstage) action based on the item's git status.
 *
 * @param gitItemStatus - Per-item git status, when the parent collection is git-backed.
 * @param onStageItem - Stages the item file for commit.
 * @param onUnstageItem - Unstages the item file.
 * @returns Menu groups to splice into a row actions menu, or an empty array when clean.
 */
export function buildGitItemMenuGroups(
  gitItemStatus: GitRequestFileStatus | undefined,
  onStageItem: () => void,
  onUnstageItem: () => void
): MenuItem[][] {
  if (gitItemStatus == null || (!gitItemStatus.canAdd && !gitItemStatus.canRemove)) {
    return [];
  }

  const action = gitItemStatus.canRemove
    ? { label: 'Remove', onSelect: onUnstageItem }
    : { label: 'Add', onSelect: onStageItem };

  return [
    [
      {
        label: 'Git',
        submenu: [[action]]
      }
    ]
  ];
}
