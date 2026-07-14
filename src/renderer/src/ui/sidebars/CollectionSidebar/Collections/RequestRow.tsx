import { RowActionsMenu, SidebarRequestItem } from '@harborclient/sdk/components';
import type { SavedRequest } from '#/shared/types';

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
import { requestDragId } from '#/renderer/src/ui/sidebars/CollectionSidebar/Collections/utils';
import { type JSX, type MouseEvent, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  buildDevInspectMenuGroups,
  useDeveloperToolsEnabled,
  type InspectPoint
} from '#/renderer/src/ui/shared/devInspectContextMenu';
import { SidebarRowActionsMenu } from '#/renderer/src/ui/sidebars/CollectionSidebar/SidebarRowActionsMenu';
import { buildGitItemMenuGroups } from '#/renderer/src/ui/sidebars/CollectionSidebar/buildGitItemMenuGroups';
import {
  buildGitItemAccessibleName,
  gitItemNameClass
} from '#/renderer/src/git/gitCommitChangeDisplay';
import { useSidebarExpansion } from '#/renderer/src/ui/sidebars/CollectionSidebar/useSidebarExpansion';
import type { GitRequestFileStatus } from '#/shared/types';

interface Props {
  /**
   * Saved request rendered in this row.
   */
  req: SavedRequest;

  /**
   * Currently active request id, used for row selection styling.
   */
  activeRequestId?: number;

  /**
   * Whether this row is part of the current multi-selection.
   */
  selected: boolean;

  /**
   * Number of selected request rows in the sidebar.
   */
  selectionCount: number;

  /**
   * Saved request ids currently open in request tabs.
   */
  openRequestIds: ReadonlySet<number>;

  /**
   * Id of the open row actions menu, if any.
   */
  openMenuId: string | null;

  /**
   * Called when a row actions menu opens or closes.
   */
  onOpenChange: (menuId: string | null) => void;

  /**
   * Handles primary and modifier clicks on the request row label.
   */
  onRowClick: (req: SavedRequest, event: MouseEvent<HTMLElement>) => void;

  /**
   * Updates selection before opening the context menu when needed.
   */
  onBeforeContextMenu: (req: SavedRequest) => void;

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
   * When true, renders the row without drag-and-drop reordering.
   */
  dragDisabled?: boolean;

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
 * Renders a draggable saved-request row with method badge and row actions menu.
 */
export function RequestRow({
  req,
  activeRequestId,
  selected,
  selectionCount,
  openRequestIds,
  openMenuId,
  onOpenChange,
  onRowClick,
  onBeforeContextMenu,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onRunRequest,
  onDeleteRequest,
  onDuplicateRequest,
  onExportRequest,
  aiChatAvailable,
  onCopyToChat,
  onRunSelected,
  onOpenSelected,
  onNewTabGroupFromSelected,
  onDeleteSelected,
  dragDisabled = false,
  gitItemStatus,
  onGitStageItem,
  onGitUnstageItem
}: Props): JSX.Element {
  const confirm = useConfirm();
  const developerToolsEnabled = useDeveloperToolsEnabled();
  const { showColorDots } = useSidebarExpansion();
  const [inspectPoint, setInspectPoint] = useState<InspectPoint | undefined>(undefined);
  const pluginContextMenuItems = usePluginContextMenuItems();
  const globalVariables = useAppSelector((state) => state.settings.general.globalVariables);
  const collections = useAppSelector(selectCollections);
  const environments = useAppSelector(selectEnvironments);
  const activeEnvironmentId = useAppSelector(selectActiveEnvironmentId);

  /**
   * Resolves the saved request URL with current globals, collection, and environment variables.
   */
  const resolvedUrl = useMemo(() => {
    const collection = collections.find((entry) => entry.id === req.collection_id);
    const environment = activeEnvironmentId
      ? environments.find((entry) => entry.id === activeEnvironmentId)
      : undefined;
    const runtimeVars = buildSendRuntimeVars(
      globalVariables,
      collection?.variables ?? [],
      environment?.variables ?? []
    );
    return resolveRequestUrl(req.url, req.params, runtimeVars);
  }, [
    activeEnvironmentId,
    collections,
    environments,
    globalVariables,
    req.collection_id,
    req.params,
    req.url
  ]);

  const menuId = `request-${req.id}`;
  const showBulkMenu = selected && selectionCount > 1;
  const rowHighlighted = activeRequestId === req.id || selected || openRequestIds.has(req.id);

  const baseMenuGroups = useMemo(() => {
    const reorderItems = [
      ...(canMoveUp ? [{ label: 'Move up', onSelect: onMoveUp }] : []),
      ...(canMoveDown ? [{ label: 'Move down', onSelect: onMoveDown }] : [])
    ];

    const copyItem =
      req.url.trim() !== ''
        ? [
            {
              label: 'Copy',
              onSelect: () => {
                void navigator.clipboard.writeText(resolvedUrl).then(() => {
                  toast.success('Copied to clipboard');
                });
              }
            }
          ]
        : [];

    const copyToChatItem = aiChatAvailable
      ? [
          {
            label: 'Copy to chat',
            onSelect: () => onCopyToChat(req)
          }
        ]
      : [];

    return showBulkMenu
      ? [
          [{ label: 'Run', onSelect: onRunSelected }],
          [{ label: 'Open', onSelect: onOpenSelected }],
          [{ label: 'New Tab Group', onSelect: onNewTabGroupFromSelected }],
          [
            {
              label: 'Delete',
              variant: 'danger' as const,
              onSelect: () => {
                void onDeleteSelected();
              }
            }
          ]
        ]
      : [
          [...copyItem, ...copyToChatItem, { label: 'Run', onSelect: onRunRequest }],
          ...(reorderItems.length > 0 ? [reorderItems] : []),
          [
            {
              label: 'Duplicate',
              onSelect: () => void onDuplicateRequest(req)
            },
            {
              label: 'Export',
              onSelect: () => void onExportRequest(req)
            }
          ],
          ...buildPluginContextMenuGroups(
            'request',
            {
              requestId: req.id,
              collectionId: req.collection_id,
              folderId: req.folder_id
            },
            pluginContextMenuItems
          ),
          ...buildGitItemMenuGroups(
            onGitStageItem != null,
            gitItemStatus,
            () => onGitStageItem?.(),
            () => onGitUnstageItem?.()
          ),
          [
            {
              label: 'Delete',
              variant: 'danger' as const,
              onSelect: () => {
                void (async () => {
                  const confirmed = await confirm({
                    title: 'Delete request',
                    message: `Delete request "${req.name}"?`,
                    confirmLabel: 'Delete',
                    variant: 'danger'
                  });
                  if (confirmed) {
                    void onDeleteRequest(req.id);
                  }
                })();
              }
            }
          ],
          ...buildDevInspectMenuGroups(inspectPoint, menuId, developerToolsEnabled)
        ];
  }, [
    aiChatAvailable,
    canMoveDown,
    canMoveUp,
    confirm,
    developerToolsEnabled,
    inspectPoint,
    menuId,
    onCopyToChat,
    onDeleteRequest,
    onDeleteSelected,
    onDuplicateRequest,
    onExportRequest,
    onGitStageItem,
    onGitUnstageItem,
    gitItemStatus,
    onMoveDown,
    onMoveUp,
    onNewTabGroupFromSelected,
    onOpenSelected,
    onRunRequest,
    onRunSelected,
    pluginContextMenuItems,
    req,
    resolvedUrl,
    showBulkMenu
  ]);

  const actionsMenu = showBulkMenu ? (
    <RowActionsMenu
      menuId={menuId}
      openMenuId={openMenuId}
      onOpenChange={onOpenChange}
      groups={baseMenuGroups}
    />
  ) : (
    <SidebarRowActionsMenu
      menuId={menuId}
      openMenuId={openMenuId}
      onOpenChange={onOpenChange}
      groups={baseMenuGroups}
      colorTarget={{
        kind: 'request',
        collectionId: req.collection_id,
        id: req.id,
        color: req.color ?? null
      }}
    />
  );

  return (
    <div data-sidebar-request-id={req.id} className="contents">
      <SidebarRequestItem
        method={req.method}
        name={req.name}
        nameClassName={gitItemNameClass(gitItemStatus)}
        colorDot={{
          color: req.color,
          visible: showColorDots,
          label: `Color for ${req.name}`
        }}
        selected={rowHighlighted}
        sortable={{
          id: requestDragId(req.id),
          dragHandleLabel: `Reorder request "${req.name}"`,
          disabled: dragDisabled
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onBeforeContextMenu(req);
          setInspectPoint({ x: event.clientX, y: event.clientY });
          onOpenChange(menuId);
        }}
        onClick={(event) => onRowClick(req, event)}
        ariaLabel={buildGitItemAccessibleName(req.name, gitItemStatus)}
        ariaCurrent={activeRequestId === req.id}
        ariaSelected={selected}
        actions={actionsMenu}
      />
    </div>
  );
}
