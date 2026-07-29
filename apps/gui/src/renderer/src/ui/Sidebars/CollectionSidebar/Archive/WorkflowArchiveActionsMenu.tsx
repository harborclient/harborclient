import { RowActionsMenu, type MenuItem } from '@harborclient/sdk/components';
import { type JSX, useMemo } from 'react';
import type { Workflow } from '@harborclient/core/types';

import {
  buildDevInspectMenuGroups,
  useDeveloperToolsEnabled,
  type InspectPoint
} from '#/renderer/src/ui/Shared/devInspectContextMenu';

interface Props {
  /**
   * Archived workflow this menu acts on.
   */
  workflow: Pick<Workflow, 'id' | 'name'>;

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
   * Restores this workflow to the Workflows list after confirmation.
   */
  onRestore: (workflow: Pick<Workflow, 'id' | 'name'>) => Promise<void>;

  /**
   * Moves this workflow to trash after confirmation.
   */
  onDelete: (workflow: Pick<Workflow, 'id' | 'name'>) => Promise<void>;
}

/**
 * Builds and renders the Workflow Archive row actions menu with Restore and Delete.
 */
export function WorkflowArchiveActionsMenu({
  workflow,
  openMenuId,
  onOpenChange,
  inspectPoint,
  onRestore,
  onDelete
}: Props): JSX.Element {
  const developerToolsEnabled = useDeveloperToolsEnabled();
  const menuId = `archive-workflow-${workflow.id}`;

  /**
   * Assembles Restore, Delete, and optional DevTools inspect groups.
   */
  const menuGroups = useMemo((): MenuItem[][] => {
    const groups: MenuItem[][] = [
      [
        {
          label: 'Restore',
          onSelect: () => {
            void onRestore(workflow);
          }
        }
      ],
      [
        {
          label: 'Delete',
          variant: 'danger' as const,
          onSelect: () => {
            void onDelete(workflow);
          }
        }
      ]
    ];

    const inspectGroups = buildDevInspectMenuGroups(inspectPoint, menuId, developerToolsEnabled);
    for (const group of inspectGroups) {
      groups.push(group);
    }

    return groups;
  }, [developerToolsEnabled, inspectPoint, menuId, onDelete, onRestore, workflow]);

  return (
    <div className="shrink-0" data-sidebar-actions={menuId}>
      <RowActionsMenu
        menuId={menuId}
        openMenuId={openMenuId}
        onOpenChange={onOpenChange}
        groups={menuGroups}
      />
    </div>
  );
}
