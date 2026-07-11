import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import {
  Button,
  EmptyState,
  FaIcon,
  RowActionsMenu,
  buildReorderMenuGroup
} from '@harborclient/sdk/components';
import { useCallback, useMemo, useState, type JSX } from 'react';
import type { TabGroup } from '#/shared/types/tabGroup';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { openTabGroupModal } from '#/renderer/src/store/slices/modalsSlice';
import { selectTabGroups } from '#/renderer/src/store/slices/tabGroupSlice';
import {
  deleteTabGroup,
  editTabGroup,
  exportTabGroup,
  openTabGroup,
  reorderTabGroups
} from '#/renderer/src/store/thunks/tabGroups';
import { faLayerGroup } from '#/renderer/src/fontawesome';
import { SortableRow } from '#/renderer/src/ui/sidebars/CollectionSidebar/Collections/SortableRow';
import { parseTabGroupDragId, tabGroupDragId, tabGroupSummaryText } from './utils';

/**
 * Tab Groups sidebar section listing saved request tab groups with drag reordering.
 */
export function TabGroups(): JSX.Element {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const groups = useAppSelector(selectTabGroups);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [activeDragGroup, setActiveDragGroup] = useState<TabGroup | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  /**
   * Stable sortable ids for tab group rows.
   */
  const groupIds = useMemo(() => groups.map((group) => tabGroupDragId(group.id)), [groups]);

  /**
   * Opens every request in the selected tab group.
   *
   * @param group - Tab group row to open.
   */
  const handleOpenGroup = useCallback(
    (group: TabGroup): void => {
      void dispatch(openTabGroup(group.id));
    },
    [dispatch]
  );

  /**
   * Deletes a tab group after confirmation.
   *
   * @param group - Tab group to delete.
   */
  const handleDeleteGroup = useCallback(
    async (group: TabGroup): Promise<void> => {
      const confirmed = await confirm({
        title: 'Delete tab group',
        message: `Delete tab group "${group.name}"?`,
        confirmLabel: 'Delete',
        variant: 'danger'
      });
      if (confirmed) {
        void dispatch(deleteTabGroup(group.id));
      }
    },
    [confirm, dispatch]
  );

  /**
   * Persists a new tab group order after drag-and-drop or menu moves.
   *
   * @param orderedTabGroupIds - Tab group ids in desired order.
   */
  const onReorderTabGroups = useCallback(
    async (orderedTabGroupIds: number[]): Promise<void> => {
      await dispatch(reorderTabGroups(orderedTabGroupIds));
    },
    [dispatch]
  );

  /**
   * Moves a tab group one position up or down in the sidebar list.
   *
   * @param groupId - Tab group to move.
   * @param direction - Whether to move toward the top or bottom of the list.
   */
  const moveTabGroup = useCallback(
    async (groupId: number, direction: 'up' | 'down'): Promise<void> => {
      const ids = groups.map((group) => group.id);
      const index = ids.findIndex((id) => id === groupId);
      if (index < 0) return;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= ids.length) return;
      await onReorderTabGroups(arrayMove(ids, index, targetIndex));
    },
    [groups, onReorderTabGroups]
  );

  /**
   * Records the tab group being dragged for overlay preview.
   *
   * @param event - Drag start event from dnd-kit.
   */
  const handleDragStart = (event: DragStartEvent): void => {
    const groupId = parseTabGroupDragId(String(event.active.id));
    if (groupId == null) return;
    const group = groups.find((item) => item.id === groupId) ?? null;
    setActiveDragGroup(group);
  };

  /**
   * Persists a new order when a tab group row is dropped.
   *
   * @param event - Drag end event from dnd-kit.
   */
  const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
    const { active, over } = event;
    setActiveDragGroup(null);
    if (!over) return;

    const activeId = parseTabGroupDragId(String(active.id));
    const overId = parseTabGroupDragId(String(over.id));
    if (activeId == null || overId == null || activeId === overId) return;

    const ids = groups.map((group) => group.id);
    const oldIndex = ids.findIndex((id) => id === activeId);
    const newIndex = ids.findIndex((id) => id === overId);
    if (oldIndex < 0 || newIndex < 0) return;

    await onReorderTabGroups(arrayMove(ids, oldIndex, newIndex));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={(event) => void handleDragEnd(event)}
      onDragCancel={() => setActiveDragGroup(null)}
    >
      <div className="flex flex-col gap-0.5">
        {groups.length === 0 ? (
          <EmptyState variant="inline" className="py-1.5 pr-2 text-center">
            No tab groups yet.
          </EmptyState>
        ) : null}
        <SortableContext items={groupIds} strategy={verticalListSortingStrategy}>
          {groups.map((group, groupIndex) => {
            const menuId = `tab-group-${group.id}`;

            return (
              <SortableRow
                key={group.id}
                id={tabGroupDragId(group.id)}
                className="group flex items-center gap-1 rounded-md py-0.5 pr-1.5 pl-0 hover:bg-selection/60"
                dragHandleLabel={`Reorder tab group "${group.name}"`}
                compact
                onRowContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setOpenMenuId(menuId);
                }}
              >
                <Button
                  variant="toolbar"
                  className="min-w-0 flex-1 justify-start gap-2 rounded-md px-2 py-1 text-left text-[16px] text-text hover:bg-transparent"
                  onClick={() => handleOpenGroup(group)}
                >
                  <FaIcon
                    icon={faLayerGroup}
                    className="h-3.5 w-3.5 shrink-0 text-muted"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">{group.name}</span>
                  <span className="shrink-0 text-[16px] text-muted">
                    {tabGroupSummaryText(group)}
                  </span>
                </Button>
                <RowActionsMenu
                  menuId={menuId}
                  openMenuId={openMenuId}
                  onOpenChange={setOpenMenuId}
                  groups={[
                    ...buildReorderMenuGroup(
                      groupIndex,
                      groups.length,
                      (direction) => void moveTabGroup(group.id, direction)
                    ),
                    [
                      {
                        label: 'Edit',
                        onSelect: () => {
                          void dispatch(editTabGroup(group.id));
                        }
                      },
                      {
                        label: 'Rename',
                        onSelect: () =>
                          dispatch(
                            openTabGroupModal({
                              mode: 'rename',
                              groupId: group.id,
                              name: group.name
                            })
                          )
                      },
                      {
                        label: 'Clone',
                        onSelect: () =>
                          dispatch(
                            openTabGroupModal({
                              mode: 'clone',
                              groupId: group.id,
                              name: `Copy of ${group.name}`
                            })
                          )
                      },
                      {
                        label: 'Export',
                        onSelect: () => {
                          void dispatch(exportTabGroup(group.id));
                        }
                      }
                    ],
                    [
                      {
                        label: 'Delete',
                        variant: 'danger',
                        onSelect: () => {
                          void handleDeleteGroup(group);
                        }
                      }
                    ]
                  ]}
                />
              </SortableRow>
            );
          })}
        </SortableContext>
      </div>

      <DragOverlay>
        {activeDragGroup ? (
          <div className="rounded border border-separator bg-surface px-2 py-1 text-[16px] font-medium shadow-md">
            {activeDragGroup.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
