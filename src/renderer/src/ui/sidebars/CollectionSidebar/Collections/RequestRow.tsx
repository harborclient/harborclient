import { RowActionsMenu } from '@harborclient/sdk/components';
import { METHOD_CLASSES, sourceRow } from '#/renderer/src/ui/shared/classes';
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
import { stopSortableDragPointerDown } from './sortableRowUtils';
import { SortableRow } from './SortableRow';
import { SidebarColorDot } from '#/renderer/src/ui/sidebars/CollectionSidebar/SidebarColorDot';
import { SidebarRowActionsMenu } from '#/renderer/src/ui/sidebars/CollectionSidebar/SidebarRowActionsMenu';

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
  onRowClick: (req: SavedRequest, event: MouseEvent<HTMLButtonElement>) => void;

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
}

/**
 * Renders a draggable saved-request row with method badge and row actions menu.
 */
export function RequestRow({
  req,
  activeRequestId,
  selected,
  selectionCount,
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
  dragDisabled = false
}: Props): JSX.Element {
  const confirm = useConfirm();
  const developerToolsEnabled = useDeveloperToolsEnabled();
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
  const rowHighlighted = activeRequestId === req.id || selected;

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

  return (
    <SortableRow
      id={requestDragId(req.id)}
      className={sourceRow(rowHighlighted, true)}
      dragHandleLabel={`Reorder request "${req.name}"`}
      disabled={dragDisabled}
      onRowContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onBeforeContextMenu(req);
        setInspectPoint({ x: event.clientX, y: event.clientY });
        onOpenChange(menuId);
      }}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 border-none bg-transparent py-0 text-left text-inherit app-no-drag"
        aria-current={activeRequestId === req.id ? 'true' : undefined}
        aria-selected={selected ? 'true' : undefined}
        onClick={(event) => onRowClick(req, event)}
      >
        <span
          className={`shrink-0 px-1 py-px ${METHOD_CLASSES[req.method.toLowerCase()] ?? 'text-info'}`}
        >
          {req.method}
        </span>
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span className="truncate">{req.name}</span>
          <SidebarColorDot color={req.color} label={`Color for ${req.name}`} />
        </span>
      </button>
      <div className="shrink-0" onPointerDown={stopSortableDragPointerDown}>
        {showBulkMenu ? (
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
        )}
      </div>
    </SortableRow>
  );
}
