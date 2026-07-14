import type { MenuItem } from '@harborclient/sdk/components';

/**
 * Builds row actions for one changed request or markdown file in the Git sidebar.
 *
 * @param onRevert - Discards uncommitted working-tree changes for the file.
 * @returns Menu groups for {@link RowActionsMenu}.
 */
export function buildGitChangeRowMenuGroups(onRevert: () => void): MenuItem[][] {
  return [
    [
      {
        label: 'Revert changes',
        variant: 'danger',
        onSelect: onRevert
      }
    ]
  ];
}
