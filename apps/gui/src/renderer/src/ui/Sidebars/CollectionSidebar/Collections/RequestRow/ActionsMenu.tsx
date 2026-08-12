import {
  AnchorMenuPanel,
  COPY_TO_CHAT_LABEL,
  RowActionsMenu,
  type MenuItem,
  type MenuPosition
} from '@harborclient/sdk/components';
import type { GitRequestFileStatus, SavedRequest } from '@harborclient/core/types';

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
import { buildCopyIdMenuItem } from '#/renderer/src/ui/Sidebars/CollectionSidebar/menus/copyEntityId';
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
  openMenuId?: string | null;

  /**
   * Called when a row actions menu opens or closes.
   */
  onOpenChange?: (menuId: string | null) => void;

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
   * Creates a workspace from the current multi-selection.
   */
  onNewWorkspaceFromSelected: () => void;

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

  /**
   * How the menu is presented. Defaults to `row`.
   */
  presentation?: 'row' | 'anchor';

  /**
   * Host viewport coordinates when {@link presentation} is `anchor`.
   */
  anchorPosition?: MenuPosition;

  /**
   * Called when an anchored menu dismisses.
   */
  onDismiss?: () => void;
}

/**
 * Builds and renders the request row actions menu, switching between bulk and
 * single-item menus (including marker picker) based on selection size.
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
      groups.push([{ label: 'New Workspace', onSelect: props.onNewWorkspaceFromSelected }]);
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
    const gitGroups = buildGitItemMenuGroups(
      props.onGitStageItem != null,
      props.gitItemStatus,
      () => props.onGitStageItem?.(),
      () => props.onGitUnstageItem?.()
    );
    if (gitGroups.length > 0) {
      primaryGroup.push(...gitGroups[0]);
    }
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
    primaryGroup.push(buildCopyIdMenuItem(props.req.uuid));
    if (props.aiChatAvailable) {
      primaryGroup.push({
        label: COPY_TO_CHAT_LABEL,
        onSelect: () => props.onCopyToChat(props.req)
      });
    }
    groups.push(primaryGroup);

    groups.push([
      { label: 'Run', onSelect: props.onRunRequest },
      {
        label: 'Export',
        onSelect: () => void props.onExportRequest(props.req)
      }
    ]);

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

    return groups;
  }, [confirm, menuId, pluginContextMenuItems, props, resolvedUrl, showBulkMenu]);

  /**
   * DevTools inspect actions render after marker groups so Inspect Element stays last.
   */
  const trailingGroups = useMemo(
    () => buildDevInspectMenuGroups(props.inspectPoint, menuId, developerToolsEnabled),
    [developerToolsEnabled, menuId, props.inspectPoint]
  );

  if (showBulkMenu) {
    if (props.presentation === 'anchor' && props.anchorPosition != null) {
      return (
        <AnchorMenuPanel
          menuId={menuId}
          groups={baseMenuGroups}
          anchor={props.anchorPosition}
          onDismiss={() => {
            props.onDismiss?.();
          }}
        />
      );
    }
    return (
      <RowActionsMenu
        menuId={menuId}
        openMenuId={props.openMenuId ?? null}
        onOpenChange={props.onOpenChange ?? (() => undefined)}
        triggerTabIndex={-1}
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
      trailingGroups={trailingGroups}
      markerTarget={{
        kind: 'request',
        collectionId: props.req.collection_id,
        id: props.req.id,
        marker: props.req.marker ?? null
      }}
      presentation={props.presentation}
      anchorPosition={props.anchorPosition}
      onDismiss={props.onDismiss}
    />
  );
}
