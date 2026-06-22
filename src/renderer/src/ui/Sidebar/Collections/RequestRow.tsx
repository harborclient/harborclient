import type { Folder, SavedRequest } from '#/shared/types';
import { RowActionsMenu } from '#/renderer/src/components/RowActionsMenu';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { METHOD_CLASSES, sourceRow } from '#/renderer/src/ui/shared/classes';
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
   * Folders in the same collection, used for move-to menu items.
   */
  folders: Folder[];

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
   * Moves the request to another folder or collection root.
   */
  onMoveRequest: (requestId: number, folderId: number | null) => void;
}

/**
 * Renders a draggable saved-request row with method badge and row actions menu.
 */
export function RequestRow({
  req,
  activeRequestId,
  openMenuId,
  onOpenChange,
  folders,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onLoadRequest,
  onDeleteRequest,
  onDuplicateRequest,
  onExportRequest,
  onMoveRequest
}: Props): JSX.Element {
  const confirm = useConfirm();

  const reorderItems = [
    ...(canMoveUp ? [{ label: 'Move up', onSelect: onMoveUp }] : []),
    ...(canMoveDown ? [{ label: 'Move down', onSelect: onMoveDown }] : [])
  ];

  const moveToItems = [
    ...(req.folder_id != null
      ? [{ label: 'Move to root', onSelect: () => onMoveRequest(req.id, null) }]
      : []),
    ...folders
      .filter((folder) => folder.id !== req.folder_id)
      .map((folder) => ({
        label: `Move to ${folder.name}`,
        onSelect: () => onMoveRequest(req.id, folder.id)
      }))
  ];

  const moveGroup = [...reorderItems, ...moveToItems];

  return (
    <SortableRow
      id={requestDragId(req.id)}
      className={sourceRow(activeRequestId === req.id)}
      dragHandleLabel={`Reorder request "${req.name}"`}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 border-none bg-transparent py-0.5 text-left text-inherit app-no-drag"
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
          ...(moveGroup.length > 0 ? [moveGroup] : []),
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
