import { RowActionsMenu, type MenuItem } from '@harborclient/sdk/components';
import { type JSX, useMemo } from 'react';

import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import {
  buildDevInspectMenuGroups,
  useDeveloperToolsEnabled,
  type InspectPoint
} from '#/renderer/src/ui/Shared/devInspectContextMenu';

interface Props {
  /**
   * Saved run identity and label used for the menu id and confirm copy.
   */
  runResult: { id: number; label: string };

  /**
   * Whether to show the multi-select bulk actions menu instead of single-item actions.
   */
  showBulkMenu: boolean;

  /**
   * Id of the currently open row actions menu, if any.
   */
  openMenuId: string | null;

  /**
   * Called when this menu opens or closes.
   */
  onOpenChange: (menuId: string | null) => void;

  /**
   * Cursor position captured when the row context menu opened, for DevTools inspect.
   */
  inspectPoint: InspectPoint | undefined;

  /**
   * Deletes this saved run result after the user confirms.
   */
  onDelete: (id: number) => Promise<void>;

  /**
   * Deletes every run result in the current multi-selection (parent confirms).
   */
  onDeleteSelected: () => void;
}

/**
 * Builds and renders the saved-run row actions menu, switching between bulk
 * delete and single-item delete with confirmation based on multi-selection size.
 */
export function ActionsMenu({
  runResult,
  showBulkMenu,
  openMenuId,
  onOpenChange,
  inspectPoint,
  onDelete,
  onDeleteSelected
}: Props): JSX.Element {
  const confirm = useConfirm();
  const developerToolsEnabled = useDeveloperToolsEnabled();
  const menuId = `run-result-${runResult.id}`;

  /**
   * Assembles delete and inspect groups for bulk or single-item saved-run menus.
   */
  const menuGroups = useMemo((): MenuItem[][] => {
    /**
     * Confirms and deletes this saved run when the user chooses Delete.
     */
    const handleDelete = (): void => {
      void (async () => {
        const confirmed = await confirm({
          title: 'Delete run',
          message: `Delete saved run "${runResult.label}"?`,
          confirmLabel: 'Delete',
          variant: 'danger'
        });
        if (confirmed) {
          void onDelete(runResult.id);
        }
      })();
    };

    const groups: MenuItem[][] = showBulkMenu
      ? [
          [
            {
              label: 'Delete',
              variant: 'danger' as const,
              onSelect: onDeleteSelected
            }
          ]
        ]
      : [
          [
            {
              label: 'Delete',
              variant: 'danger',
              onSelect: handleDelete
            }
          ]
        ];

    const inspectGroups = buildDevInspectMenuGroups(inspectPoint, menuId, developerToolsEnabled);
    for (const group of inspectGroups) {
      groups.push(group);
    }

    return groups;
  }, [
    confirm,
    developerToolsEnabled,
    inspectPoint,
    menuId,
    onDelete,
    onDeleteSelected,
    runResult.id,
    runResult.label,
    showBulkMenu
  ]);

  return (
    <RowActionsMenu
      menuId={menuId}
      openMenuId={openMenuId}
      onOpenChange={onOpenChange}
      groups={menuGroups}
    />
  );
}
