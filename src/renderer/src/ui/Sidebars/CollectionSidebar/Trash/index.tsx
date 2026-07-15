import {
  Button,
  EmptyState,
  FaIcon,
  RowActionsMenu,
  SIDEBAR_ITEM_BUTTON_CLASS
} from '@harborclient/sdk/components';
import { useCallback, useMemo, useState, type JSX } from 'react';
import type { TrashItem } from '#/shared/types/trash';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectTrashItems } from '#/renderer/src/store/slices/trashSlice';
import {
  emptyTrash,
  permanentlyDeleteTrashItem,
  restoreTrashItem
} from '#/renderer/src/store/thunks/trash';
import { useSidebarRowSelection } from '#/renderer/src/ui/Sidebars/CollectionSidebar/useSidebarRowSelection';
import { faCircleMinus } from '#/renderer/src/fontawesome';
import { sourceRow } from '#/renderer/src/ui/Shared/classes';
import { formatTrashDeletedAt, trashEntityTypeLabel } from './utils';

/**
 * Header actions for the Trash sidebar section.
 */
export function TrashHeaderActions(): JSX.Element {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const items = useAppSelector(selectTrashItems);
  const isEmpty = items.length === 0;

  /**
   * Permanently deletes every trash snapshot row after confirmation.
   */
  const handleEmptyTrash = useCallback(async (): Promise<void> => {
    const confirmed = await confirm({
      title: 'Empty trash',
      message: 'Permanently delete everything in trash? This cannot be undone.',
      confirmLabel: 'Empty trash',
      variant: 'danger'
    });
    if (confirmed) {
      void dispatch(emptyTrash());
    }
  }, [confirm, dispatch]);

  return (
    <Button
      variant="toolbar"
      className="text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
      aria-label="Empty trash"
      disabled={isEmpty}
      onClick={() => {
        void handleEmptyTrash();
      }}
    >
      <FaIcon icon={faCircleMinus} className="h-3.5 w-3.5" />
    </Button>
  );
}

/**
 * Returns the accessible label for a trash row.
 *
 * @param item - Trash sidebar row.
 */
function trashItemAriaLabel(item: TrashItem): string {
  return `${item.label}, ${trashEntityTypeLabel(item.entityType)}, deleted ${formatTrashDeletedAt(item.deletedAt)}`;
}

/**
 * Sidebar section listing deleted sidebar entities that can be restored.
 */
export function Trash(): JSX.Element {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const items = useAppSelector(selectTrashItems);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  /**
   * Trash row ids in on-screen list order for shift-click range selection.
   */
  const visibleOrder = useMemo(() => items.map((item) => item.id), [items]);

  const { selectionCount, selectedOrdered, handleBeforeContextMenu, handleRowClick, isSelected } =
    useSidebarRowSelection(visibleOrder, { selectionKey: 'trash' });

  /**
   * Restores the selected trash rows when multiple rows are selected.
   */
  const handleRestoreSelected = useCallback(async (): Promise<void> => {
    for (const id of selectedOrdered) {
      await dispatch(restoreTrashItem(id));
    }
  }, [dispatch, selectedOrdered]);

  /**
   * Permanently deletes the selected trash rows after confirmation.
   */
  const handleDeleteSelected = useCallback(async (): Promise<void> => {
    const confirmed = await confirm({
      title: 'Permanently delete',
      message:
        selectionCount > 1
          ? `Permanently delete ${selectionCount} items from trash?`
          : 'Permanently delete this item from trash?',
      confirmLabel: 'Delete',
      variant: 'danger'
    });
    if (!confirmed) {
      return;
    }

    for (const id of selectedOrdered) {
      await dispatch(permanentlyDeleteTrashItem(id));
    }
  }, [confirm, dispatch, selectedOrdered, selectionCount]);

  /**
   * Restores one trash row.
   *
   * @param item - Trash snapshot row to restore.
   */
  const handleRestoreItem = useCallback(
    (item: TrashItem): void => {
      void dispatch(restoreTrashItem(item.id));
    },
    [dispatch]
  );

  /**
   * Permanently deletes one trash row after confirmation.
   *
   * @param item - Trash snapshot row to delete.
   */
  const handleDeleteItem = useCallback(
    async (item: TrashItem): Promise<void> => {
      const confirmed = await confirm({
        title: 'Permanently delete',
        message: `Permanently delete "${item.label}" from trash?`,
        confirmLabel: 'Delete',
        variant: 'danger'
      });
      if (confirmed) {
        await dispatch(permanentlyDeleteTrashItem(item.id));
      }
    },
    [confirm, dispatch]
  );

  if (items.length === 0) {
    return (
      <EmptyState variant="inline" className="pr-2 py-1.5 text-center">
        Trash is empty.
      </EmptyState>
    );
  }

  return (
    <div className="sidebar-source-list flex flex-col gap-0.5 px-1 pb-1">
      {items.map((item) => {
        const menuId = `trash-item-${item.id}`;
        const selected = isSelected(item.id);
        const showBulkMenu = selected && selectionCount > 1;

        return (
          <div
            key={item.id}
            className={sourceRow(selected, true)}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleBeforeContextMenu(item.id);
              setOpenMenuId(menuId);
            }}
          >
            <button
              type="button"
              className={`${SIDEBAR_ITEM_BUTTON_CLASS} items-start gap-2 px-2 py-1.5`}
              aria-label={trashItemAriaLabel(item)}
              onClick={(event) => {
                handleRowClick(item.id, {
                  shiftKey: event.shiftKey,
                  ctrlOrMetaKey: event.ctrlKey || event.metaKey
                });
              }}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-text">{item.label}</span>
                <span className="truncate text-[14px] text-muted">
                  {formatTrashDeletedAt(item.deletedAt)}
                </span>
              </div>
              <span className="shrink-0 self-start text-muted">
                {trashEntityTypeLabel(item.entityType)}
              </span>
            </button>
            <RowActionsMenu
              menuId={menuId}
              openMenuId={openMenuId}
              onOpenChange={setOpenMenuId}
              groups={
                showBulkMenu
                  ? [
                      [{ label: 'Restore', onSelect: () => void handleRestoreSelected() }],
                      [
                        {
                          label: 'Permanently delete',
                          variant: 'danger',
                          onSelect: () => void handleDeleteSelected()
                        }
                      ]
                    ]
                  : [
                      [{ label: 'Restore', onSelect: () => handleRestoreItem(item) }],
                      [
                        {
                          label: 'Permanently delete',
                          variant: 'danger' as const,
                          onSelect: () => {
                            void handleDeleteItem(item);
                          }
                        }
                      ]
                    ]
              }
            />
          </div>
        );
      })}
    </div>
  );
}
