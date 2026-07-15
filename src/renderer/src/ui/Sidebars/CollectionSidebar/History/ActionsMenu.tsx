import { RowActionsMenu, type MenuItem } from '@harborclient/sdk/components';
import type { RequestHistoryEntry } from '#/shared/types/requestHistory';
import { type JSX, useMemo } from 'react';

import {
  buildDevInspectMenuGroups,
  useDeveloperToolsEnabled,
  type InspectPoint
} from '#/renderer/src/ui/Shared/devInspectContextMenu';

interface Props {
  /**
   * History entry this menu acts on (single-delete target and menu id).
   */
  entry: RequestHistoryEntry;

  /**
   * Whether to show the multi-select bulk delete menu instead of single-item delete.
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
   * Deletes this history entry after confirmation in the parent.
   */
  onDeleteEntry: (entry: RequestHistoryEntry) => void;

  /**
   * Deletes every history entry in the current multi-selection.
   */
  onDeleteSelected: () => void;
}

/**
 * Builds and renders the history row actions menu, switching between bulk
 * delete and single-item delete based on multi-selection size.
 */
export function ActionsMenu({
  entry,
  showBulkMenu,
  openMenuId,
  onOpenChange,
  inspectPoint,
  onDeleteEntry,
  onDeleteSelected
}: Props): JSX.Element {
  const developerToolsEnabled = useDeveloperToolsEnabled();
  const menuId = `history-entry-${entry.id}`;

  /**
   * Assembles delete and inspect groups for bulk or single-item history menus.
   */
  const menuGroups = useMemo((): MenuItem[][] => {
    const groups: MenuItem[][] = showBulkMenu
      ? [
          [
            {
              label: 'Delete',
              variant: 'danger' as const,
              onSelect: () => {
                onDeleteSelected();
              }
            }
          ]
        ]
      : [
          [
            {
              label: 'Delete',
              variant: 'danger',
              onSelect: () => {
                onDeleteEntry(entry);
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
    entry,
    inspectPoint,
    menuId,
    onDeleteEntry,
    onDeleteSelected,
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
