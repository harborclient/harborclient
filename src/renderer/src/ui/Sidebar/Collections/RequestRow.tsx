import { RowActionsMenu } from '@harborclient/sdk/components';
import { METHOD_CLASSES, sourceRow } from '#/renderer/src/ui/shared/classes';
import type { SavedRequest } from '#/shared/types';

import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { usePluginContextMenuItems } from '#/renderer/src/plugins/pluginHooks';
import { buildPluginContextMenuGroups } from '#/renderer/src/plugins/pluginContextMenuHelpers';
import { requestDragId } from '#/renderer/src/ui/Sidebar/Collections/utils';
import { type JSX } from 'react';
import { SortableRow } from './SortableRow';

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
   * Id of the open row actions menu, if any.
   */
  openMenuId: string | null;

  /**
   * Called when a row actions menu opens or closes.
   */
  onOpenChange: (menuId: string | null) => void;

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
   * Loads the request into the editor.
   */
  onLoadRequest: (req: SavedRequest) => void;

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
  openMenuId,
  onOpenChange,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onRunRequest,
  onLoadRequest,
  onDeleteRequest,
  onDuplicateRequest,
  onExportRequest,
  dragDisabled = false
}: Props): JSX.Element {
  const confirm = useConfirm();
  const pluginContextMenuItems = usePluginContextMenuItems();

  const reorderItems = [
    ...(canMoveUp ? [{ label: 'Move up', onSelect: onMoveUp }] : []),
    ...(canMoveDown ? [{ label: 'Move down', onSelect: onMoveDown }] : [])
  ];

  return (
    <SortableRow
      id={requestDragId(req.id)}
      className={sourceRow(activeRequestId === req.id, true)}
      dragHandleLabel={`Reorder request "${req.name}"`}
      disabled={dragDisabled}
      compact
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 border-none bg-transparent py-0 text-left text-inherit app-no-drag"
        aria-current={activeRequestId === req.id ? 'true' : undefined}
        onClick={() => onLoadRequest(req)}
      >
        <span
          className={`shrink-0 px-1 py-px text-[14px] ${METHOD_CLASSES[req.method.toLowerCase()] ?? 'text-info'}`}
        >
          {req.method}
        </span>
        <span className="truncate text-[14px]">{req.name}</span>
      </button>
      <RowActionsMenu
        menuId={`request-${req.id}`}
        openMenuId={openMenuId}
        onOpenChange={onOpenChange}
        groups={[
          [{ label: 'Run', onSelect: onRunRequest }],
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
          ]
        ]}
      />
    </SortableRow>
  );
}
