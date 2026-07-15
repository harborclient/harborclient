import { RowActionsMenu, type MenuItem } from '@harborclient/sdk/components';
import type { GitRequestFileStatus, SavedRequest } from '#/shared/types';

import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { usePluginContextMenuItems } from '#/renderer/src/plugins/pluginHooks';
import { buildPluginContextMenuGroups } from '#/renderer/src/plugins/pluginContextMenuHelpers';
import {
  buildSendRuntimeVars,
  resolveRequestUrl
} from '#/renderer/src/scripting/resolveRequestUrl';
import {
  selectActiveEnvironmentId,
  selectCollections,
  selectEnvironments
} from '#/renderer/src/store/selectors';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { type JSX, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  buildDevInspectMenuGroups,
  useDeveloperToolsEnabled,
  type InspectPoint
} from '#/renderer/src/ui/Shared/devInspectContextMenu';
import { SidebarRowActionsMenu } from '#/renderer/src/ui/Sidebars/CollectionSidebar/menus/SidebarRowActionsMenu';
import { buildGitItemMenuGroups } from '#/renderer/src/ui/Sidebars/CollectionSidebar/git/buildGitItemMenuGroups';

interface Props {
  /**
   * Saved request this menu acts on.
   */
  req: SavedRequest;

  /**
   * Whether this row is part of the current multi-selection.
   */
  selected: boolean;

  /**
   * Number of selected request rows in the sidebar.
   */
  selectionCount: number;

  /**
   * Id of the open row actions menu, if any.
   */
  openMenuId: string | null;

  /**
   * Called when a row actions menu opens or closes.
   */
  onOpenChange: (menuId: string | null) => void;

  /**
   * Cursor position from the last context-menu open, used for developer inspect.
   */
  inspectPoint?: InspectPoint;

  /**
   * Whether the request can move one position up within its list.
   */
  canMoveUp: boolean;

  /**
   * Whether the request can move one position down within its list.
   */
  canMoveDown: boolean;

  /**
   * Moves the request one position up within its current folder or root list.
   */
  onMoveUp: () => void;

  /**
   * Moves the request one position down within its current folder or root list.
   */
  onMoveDown: () => void;

  /**
   * Opens the collection runner scoped to this request.
   */
  onRunRequest: () => void;

  /**
   * Deletes the saved request.
   */
  onDeleteRequest: (id: number) => Promise<void>;

  /**
   * Duplicates the saved request.
   */
  onDuplicateRequest: (req: SavedRequest) => Promise<void>;

  /**
   * Exports the saved request to a JSON file.
   */
  onExportRequest: (req: SavedRequest) => Promise<void> | void;

  /**
   * Whether AI chat is available for "Copy to chat".
   */
  aiChatAvailable: boolean;

  /**
   * Copies the saved request reference into the AI chat composer.
   */
  onCopyToChat: (req: SavedRequest) => void;

  /**
   * Runs every request in the current multi-selection.
   */
  onRunSelected: () => void;

  /**
   * Opens every request in the current multi-selection.
   */
  onOpenSelected: () => void;

  /**
   * Creates a tab group from the current multi-selection.
   */
  onNewTabGroupFromSelected: () => void;

  /**
   * Deletes every request in the current multi-selection.
   */
  onDeleteSelected: () => void;

  /**
   * Per-item git status when the parent collection is git-backed.
   */
  gitItemStatus?: GitRequestFileStatus;

  /**
   * Stages this request for commit in a git-backed collection.
   */
  onGitStageItem?: () => void;

  /**
   * Unstages this request in a git-backed collection.
   */
  onGitUnstageItem?: () => void;
}

/**
 * Builds and renders the request row actions menu, switching between bulk and
 * single-item menus (including color picker) based on selection size.
 */
export function ActionsMenu(props: Props): JSX.Element {
  const confirm = useConfirm();
  const developerToolsEnabled = useDeveloperToolsEnabled();
  const pluginContextMenuItems = usePluginContextMenuItems();
  const globalVariables = useAppSelector((state) => state.settings.general.globalVariables);
  const collections = useAppSelector(selectCollections);
  const environments = useAppSelector(selectEnvironments);
  const activeEnvironmentId = useAppSelector(selectActiveEnvironmentId);

  /**
   * Resolves the saved request URL with current globals, collection, and environment variables.
   */
  const resolvedUrl = useMemo(() => {
    const collection = collections.find((entry) => entry.id === props.req.collection_id);
    const environment = activeEnvironmentId
      ? environments.find((entry) => entry.id === activeEnvironmentId)
      : undefined;
    const runtimeVars = buildSendRuntimeVars(
      globalVariables,
      collection?.variables ?? [],
      environment?.variables ?? []
    );
    return resolveRequestUrl(props.req.url, props.req.params, runtimeVars);
  }, [activeEnvironmentId, collections, environments, globalVariables, props]);

  const menuId = `request-${props.req.id}`;
  const showBulkMenu = props.selected && props.selectionCount > 1;

  /**
   * Assembles single-request or multi-select action groups for the row menu.
   */
  const baseMenuGroups = useMemo((): MenuItem[][] => {
    const groups: MenuItem[][] = [];

    if (showBulkMenu) {
      groups.push([{ label: 'Run', onSelect: props.onRunSelected }]);
      groups.push([{ label: 'Open', onSelect: props.onOpenSelected }]);
      groups.push([{ label: 'New Tab Group', onSelect: props.onNewTabGroupFromSelected }]);
      groups.push([
        {
          label: 'Delete',
          variant: 'danger' as const,
          onSelect: () => {
            void props.onDeleteSelected();
          }
        }
      ]);
      return groups;
    }

    const primaryGroup: MenuItem[] = [];
    if (props.req.url.trim() !== '') {
      primaryGroup.push({
        label: 'Copy',
        onSelect: () => {
          void navigator.clipboard.writeText(resolvedUrl).then(() => {
            toast.success('Copied to clipboard');
          });
        }
      });
    }
    if (props.aiChatAvailable) {
      primaryGroup.push({
        label: 'Copy to chat',
        onSelect: () => props.onCopyToChat(props.req)
      });
    }
    primaryGroup.push({ label: 'Run', onSelect: props.onRunRequest });
    groups.push(primaryGroup);

    const reorderGroup: MenuItem[] = [];
    if (props.canMoveUp) {
      reorderGroup.push({ label: 'Move up', onSelect: props.onMoveUp });
    }
    if (props.canMoveDown) {
      reorderGroup.push({ label: 'Move down', onSelect: props.onMoveDown });
    }
    if (reorderGroup.length > 0) {
      groups.push(reorderGroup);
    }

    groups.push([
      {
        label: 'Duplicate',
        onSelect: () => void props.onDuplicateRequest(props.req)
      },
      {
        label: 'Export',
        onSelect: () => void props.onExportRequest(props.req)
      }
    ]);

    const pluginGroups = buildPluginContextMenuGroups(
      'request',
      {
        requestId: props.req.id,
        collectionId: props.req.collection_id,
        folderId: props.req.folder_id
      },
      pluginContextMenuItems
    );
    for (const group of pluginGroups) {
      groups.push(group);
    }

    const gitGroups = buildGitItemMenuGroups(
      props.onGitStageItem != null,
      props.gitItemStatus,
      () => props.onGitStageItem?.(),
      () => props.onGitUnstageItem?.()
    );
    for (const group of gitGroups) {
      groups.push(group);
    }

    groups.push([
      {
        label: 'Delete',
        variant: 'danger' as const,
        onSelect: () => {
          void (async () => {
            const confirmed = await confirm({
              title: 'Delete request',
              message: `Delete request "${props.req.name}"?`,
              confirmLabel: 'Delete',
              variant: 'danger'
            });
            if (confirmed) {
              void props.onDeleteRequest(props.req.id);
            }
          })();
        }
      }
    ]);

    const inspectGroups = buildDevInspectMenuGroups(
      props.inspectPoint,
      menuId,
      developerToolsEnabled
    );
    for (const group of inspectGroups) {
      groups.push(group);
    }

    return groups;
  }, [
    confirm,
    developerToolsEnabled,
    menuId,
    pluginContextMenuItems,
    props,
    resolvedUrl,
    showBulkMenu
  ]);

  if (showBulkMenu) {
    return (
      <RowActionsMenu
        menuId={menuId}
        openMenuId={props.openMenuId}
        onOpenChange={props.onOpenChange}
        groups={baseMenuGroups}
      />
    );
  }

  return (
    <SidebarRowActionsMenu
      menuId={menuId}
      openMenuId={props.openMenuId}
      onOpenChange={props.onOpenChange}
      groups={baseMenuGroups}
      colorTarget={{
        kind: 'request',
        collectionId: props.req.collection_id,
        id: props.req.id,
        color: props.req.color ?? null
      }}
    />
  );
}
