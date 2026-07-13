import type { MenuItem } from '@harborclient/sdk/components';
import type { GitRequestFileStatus } from '#/shared/types';

/**
 * Builds Git change-row menu groups for stage, unstage, and revert actions.
 *
 * @param status - Per-request git status from the main process.
 * @param onAdd - Stages working-tree changes for the request.
 * @param onRemove - Unstages staged changes for the request.
 * @param onRevert - Discards working-tree changes for the request.
 */
export function buildGitChangesMenuGroups(
  status: GitRequestFileStatus | undefined,
  onAdd: () => void,
  onRemove: () => void,
  onRevert: () => void
): MenuItem[][] {
  if (status == null || status.displayStatus === 'clean') {
    return [];
  }

  const gitItems: MenuItem[] = [];
  if (status.canAdd) {
    gitItems.push({ label: 'Add', onSelect: onAdd });
  }
  if (status.canRemove) {
    gitItems.push({ label: 'Remove', onSelect: onRemove });
  }
  gitItems.push({ label: 'Revert changes', variant: 'danger', onSelect: onRevert });

  return [[{ label: 'Git', submenu: [gitItems] }]];
}
