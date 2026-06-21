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
  onLoadRequest,
  onDeleteRequest,
  onDuplicateRequest,
  onExportRequest,
  onMoveRequest
}: Props): JSX.Element {
  const confirm = useConfirm();
  const moveItems =
    folders.length > 0
      ? [
        {
          label: 'Move to root',
          onSelect: () => onMoveRequest(req.id, null)
        }
      ]
      : [];

  return (
    <SortableRow id={requestDragId(req.id)} className={sourceRow(activeRequestId === req.id)}>
      <button
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 border-none bg-transparent py-0.5 text-left text-inherit app-no-drag"
        onClick={() => onLoadRequest(req)}
      >
        <span
          className={`shrink-0 rounded px-1 py-px text-[10px] font-semibold ${METHOD_CLASSES[req.method.toLowerCase()] ?? 'bg-info text-white'}`}
        >
          {req.method}
        </span>
        <span className="truncate text-[13px]">{req.name}</span>
      </button>
      <RowActionsMenu
        menuId={`request-${req.id}`}
        openMenuId={openMenuId}
        onOpenChange={onOpenChange}
        items={[
          ...moveItems,
          {
            label: 'Duplicate',
            onSelect: () => void onDuplicateRequest(req)
          },
          {
            label: 'Export',
            onSelect: () => void onExportRequest(req)
          },
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
        ]}
      />
    </SortableRow>
  );
}
