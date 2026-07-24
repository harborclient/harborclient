import { RowActionsMenu, type MenuItem } from '@harborclient/sdk/components';
import { type JSX, useMemo } from 'react';
import type { TrashItem } from '#/shared/types/trash';

import {
  buildDevInspectMenuGroups,
  useDeveloperToolsEnabled,
  type InspectPoint
} from '#/renderer/src/ui/Shared/devInspectContextMenu';

interface Props {
  /**
   * Trash snapshot row this menu acts on for single-item restore/delete.
   */
  item: TrashItem;

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
   * Restores this trash row.
   */
  onRestore: (item: TrashItem) => void;

  /**
   * Permanently deletes this trash row after confirmation.
   */
  onDelete: (item: TrashItem) => Promise<void>;

  /**
   * Restores every trash row in the current multi-selection.
   */
  onRestoreSelected: () => Promise<void>;

  /**
   * Permanently deletes every trash row in the current multi-selection after confirmation.
   */
  onDeleteSelected: () => Promise<void>;
}

/**
 * Builds and renders the trash row actions menu, switching between bulk restore/delete
 * and single-item menus based on multi-selection size.
 */
export function ActionsMenu({
  item,
  showBulkMenu,
  openMenuId,
  onOpenChange,
  inspectPoint,
  onRestore,
  onDelete,
  onRestoreSelected,
  onDeleteSelected
}: Props): JSX.Element {
  const developerToolsEnabled = useDeveloperToolsEnabled();
  const menuId = `trash-item-${item.id}`;

  /**
   * Assembles restore, delete, and inspect groups for bulk or single-item trash menus.
   */
  const menuGroups = useMemo((): MenuItem[][] => {
    const groups: MenuItem[][] = showBulkMenu
      ? [
          [{ label: 'Restore', onSelect: () => void onRestoreSelected() }],
          [
            {
              label: 'Permanently delete',
              variant: 'danger',
              onSelect: () => void onDeleteSelected()
            }
          ]
        ]
      : [
          [{ label: 'Restore', onSelect: () => onRestore(item) }],
          [
            {
              label: 'Permanently delete',
              variant: 'danger' as const,
              onSelect: () => {
                void onDelete(item);
              }
            }
          ]
        ];

    const inspectGroups = buildDevInspectMenuGroups(inspectPoint, menuId, developerToolsEnabled);
    for (const group of inspectGroups) {
      groups.push(group);
    }

    return groups;
  }, [
    developerToolsEnabled,
    inspectPoint,
    item,
    menuId,
    onDelete,
    onDeleteSelected,
    onRestore,
    onRestoreSelected,
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
