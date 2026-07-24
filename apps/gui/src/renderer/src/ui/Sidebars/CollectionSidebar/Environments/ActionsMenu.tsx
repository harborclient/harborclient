import type { Environment, Variable } from '#/shared/types';
import { appendMissingEnvironmentVariables } from '#/shared/environmentVariables';
import { buildReorderMenuGroup, RowActionsMenu, type MenuItem } from '@harborclient/sdk/components';
import { type JSX, useMemo } from 'react';
import toast from 'react-hot-toast';

import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import {
  buildDevInspectMenuGroups,
  useDeveloperToolsEnabled,
  type InspectPoint
} from '#/renderer/src/ui/Shared/devInspectContextMenu';
import { SidebarRowActionsMenu } from '#/renderer/src/ui/Sidebars/CollectionSidebar/menus/SidebarRowActionsMenu';

interface Props {
  /**
   * Environment identity, display fields, and variables used by menu actions.
   */
  environment: Pick<Environment, 'id' | 'name' | 'color' | 'variables'>;

  /**
   * Zero-based index of this environment among sidebar environments.
   */
  environmentIndex: number;

  /**
   * Total number of environments, used to enable/disable reorder actions.
   */
  environmentsCount: number;

  /**
   * Name of the environment directly below this one, when Copy/Merge down is available.
   */
  environmentBelowName: string | undefined;

  /**
   * Variables of the environment directly below this one, when Copy down is available.
   */
  environmentBelowVariables: Variable[] | undefined;

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
   * Moves the environment one position up or down in the sidebar.
   */
  onMove: (direction: 'up' | 'down') => void;

  /**
   * Opens the environment settings view.
   */
  onConfigure: () => void;

  /**
   * Exports the environment to a JSON file.
   */
  onExport: () => void;

  /**
   * Duplicates the environment and its variables.
   */
  onDuplicate: () => void;

  /**
   * Copies missing variables from this environment into the one directly below it.
   */
  onCopyDown: () => void;

  /**
   * Merges this environment into the one directly below it.
   */
  onMergeDown: () => void;

  /**
   * Deletes this environment.
   */
  onDelete: () => void;

  /**
   * Deletes every environment in the current multi-selection.
   */
  onDeleteSelected: () => void;
}

/**
 * Builds and renders the environment row actions menu, switching between bulk
 * delete and single-item menus based on multi-selection size.
 */
export function ActionsMenu(props: Props): JSX.Element {
  const confirm = useConfirm();
  const developerToolsEnabled = useDeveloperToolsEnabled();
  const menuId = `environment-${props.environment.id}`;

  /**
   * Assembles reorder, settings, export, duplicate, copy/merge, delete, and inspect
   * groups for the single-environment row menu.
   */
  const singleMenuGroups = useMemo((): MenuItem[][] => {
    /**
     * Confirms and copies missing variables into the environment below.
     * Skips the dialog when there is nothing new to copy.
     */
    const handleCopyDown = (): void => {
      if (props.environmentBelowName == null || props.environmentBelowVariables == null) {
        return;
      }
      const { addedCount } = appendMissingEnvironmentVariables(
        props.environmentBelowVariables,
        props.environment.variables
      );
      if (addedCount === 0) {
        toast('No new variables to copy');
        return;
      }
      void (async () => {
        const variableLabel = addedCount === 1 ? 'variable' : 'variables';
        const confirmed = await confirm({
          title: 'Copy variables down',
          message: `Add ${addedCount} ${variableLabel} from "${props.environment.name}" to "${props.environmentBelowName}"? Existing variables in "${props.environmentBelowName}" will not be changed.`,
          confirmLabel: 'Copy down'
        });
        if (confirmed) {
          props.onCopyDown();
        }
      })();
    };

    /**
     * Confirms and merges this environment into the one below it.
     */
    const handleMergeDown = (): void => {
      if (props.environmentBelowName == null) {
        return;
      }
      void (async () => {
        const confirmed = await confirm({
          title: 'Merge environment down',
          message: `Merge "${props.environment.name}" into "${props.environmentBelowName}"? The merged environment will be named "${props.environment.name}".`,
          confirmLabel: 'Merge down'
        });
        if (confirmed) {
          props.onMergeDown();
        }
      })();
    };

    /**
     * Confirms and deletes this environment.
     */
    const handleDelete = (): void => {
      void (async () => {
        const confirmed = await confirm({
          title: 'Delete environment',
          message: `Delete environment "${props.environment.name}"?`,
          confirmLabel: 'Delete',
          variant: 'danger'
        });
        if (confirmed) {
          props.onDelete();
        }
      })();
    };

    const actionsGroup: MenuItem[] = [
      {
        label: 'Settings',
        onSelect: props.onConfigure
      },
      {
        label: 'Export',
        onSelect: props.onExport
      },
      {
        label: 'Duplicate',
        onSelect: props.onDuplicate
      }
    ];
    if (props.environmentBelowName != null) {
      actionsGroup.push(
        {
          label: 'Copy down',
          onSelect: handleCopyDown
        },
        {
          label: 'Merge down',
          onSelect: handleMergeDown
        }
      );
    }

    const dangerGroup: MenuItem[] = [
      {
        label: 'Delete',
        variant: 'danger' as const,
        onSelect: handleDelete
      }
    ];

    const reorderGroups = buildReorderMenuGroup(
      props.environmentIndex,
      props.environmentsCount,
      props.onMove
    );
    const inspectGroups = buildDevInspectMenuGroups(
      props.inspectPoint,
      menuId,
      developerToolsEnabled
    );

    return reorderGroups.concat([actionsGroup, dangerGroup], inspectGroups);
  }, [confirm, developerToolsEnabled, menuId, props]);

  if (props.showBulkMenu) {
    return (
      <RowActionsMenu
        menuId={menuId}
        openMenuId={props.openMenuId}
        onOpenChange={props.onOpenChange}
        groups={[
          [
            {
              label: 'Delete',
              variant: 'danger' as const,
              onSelect: props.onDeleteSelected
            }
          ]
        ]}
      />
    );
  }

  return (
    <SidebarRowActionsMenu
      menuId={menuId}
      openMenuId={props.openMenuId}
      onOpenChange={props.onOpenChange}
      colorTarget={{
        kind: 'environment',
        id: props.environment.id,
        color: props.environment.color ?? null
      }}
      groups={singleMenuGroups}
    />
  );
}
