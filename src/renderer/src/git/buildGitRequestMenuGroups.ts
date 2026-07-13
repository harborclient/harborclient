import type { MenuItem } from '@harborclient/sdk/components';
import type { GitRequestFileStatus } from '#/shared/types';

/**
 * Builds Git submenu groups for one request row when manual staging is relevant.
 *
 * @param status - Per-request git status from the main process.
 * @param onAdd - Stages working-tree changes for the request.
 * @param onRemove - Unstages staged changes for the request.
 */
export function buildGitRequestMenuGroups(
  status: GitRequestFileStatus | undefined,
  onAdd: () => void,
  onRemove: () => void
): MenuItem[][] {
  if (status == null || status.displayStatus === 'clean') {
    return [];
  }

  const submenu: MenuItem[] = [];
  if (status.canAdd) {
    submenu.push({ label: 'Add', onSelect: onAdd });
  }
  if (status.canRemove) {
    submenu.push({ label: 'Remove', onSelect: onRemove });
  }

  if (submenu.length === 0) {
    return [];
  }

  return [[{ label: 'Git', submenu: [submenu] }]];
}
