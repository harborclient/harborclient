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
  EmptySectionLabel,
  RowActionsMenu,
  SidebarListbox,
  SidebarWorkspaceItem,
  buildReorderMenuGroup
} from '@harborclient/sdk/components';
import { SidebarRowActionsMenu } from '#/renderer/src/ui/Sidebars/CollectionSidebar/menus/SidebarRowActionsMenu';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type MouseEvent
} from 'react';
import type { Workspace } from '@harborclient/core/types/workspace';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { openWorkspaceModal } from '#/renderer/src/store/slices/modalsSlice';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';
import { selectWorkspaces } from '#/renderer/src/store/slices/workspaceSlice';
import {
  deleteWorkspace,
  exportWorkspace,
  requestOpenWorkspace,
  reorderWorkspaces,
  saveWorkspace
} from '#/renderer/src/store/thunks/workspaces';
import { faWindowRestore } from '#/renderer/src/fontawesome';
import { useSidebarRowSelection } from '#/renderer/src/ui/Sidebars/CollectionSidebar/selection/useSidebarRowSelection';
import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/expansion/useSidebarExpansion';
import { useSidebarSectionFilter } from '#/renderer/src/ui/Sidebars/CollectionSidebar/filter/sidebarSectionFilterContext';
import { filterItemsByMarker } from '#/renderer/src/ui/Sidebars/CollectionSidebar/filter/sidebarMarkerFilter';
import {
  sortSidebarItems,
  toSortTimestamp
} from '#/renderer/src/ui/Sidebars/CollectionSidebar/sort/sidebarSort';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/Modals/dialogHelpers';
import toast from 'react-hot-toast';
import { focusWorkspaceSettings } from '#/renderer/src/ui/Tabs/WorkspaceSettings/focusWorkspaceSettings';
import { parseWorkspaceDragId, workspaceDragId, workspaceSummaryText } from './utils';

/** Delay before single-click opens a workspace so double-click can open settings instead. */
const WORKSPACE_OPEN_CLICK_DELAY_MS = 250;

export { WorkspacesHeaderActions } from './WorkspacesHeaderActions';

/**
 * Workspaces sidebar section listing saved request workspaces with drag reordering.
 */
export function Workspaces(): JSX.Element {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const allGroups = useAppSelector(selectWorkspaces);
  const { showMarkers, sectionSort } = useSidebarExpansion();
  const { workspacesMarkerFilter } = useSidebarSectionFilter();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [activeDragGroup, setActiveDragGroup] = useState<Workspace | null>(null);
  const openClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sortMode = sectionSort.workspaces;
  const sortActive = sortMode !== 'default';

  /**
   * Clears any pending delayed workspace open so double-click can open settings alone.
   */
  const cancelPendingOpen = useCallback((): void => {
    if (openClickTimerRef.current == null) {
      return;
    }
    clearTimeout(openClickTimerRef.current);
    openClickTimerRef.current = null;
  }, []);

  /**
   * Clears a pending open timer when the Workspaces section unmounts.
   */
  useEffect(() => {
    return () => {
      cancelPendingOpen();
    };
  }, [cancelPendingOpen]);

  /**
   * Workspaces limited to the selected marker when a marker filter is active,
   * then ordered by the Workspaces section sort mode.
   */
  const groups = useMemo(() => {
    const filtered = filterItemsByMarker(allGroups, workspacesMarkerFilter);
    return sortSidebarItems(filtered, sortMode, {
      name: (group) => group.name,
      createdAt: (group) => toSortTimestamp(group.createdAt),
      marker: (group) => group.marker
    });
  }, [allGroups, sortMode, workspacesMarkerFilter]);

  /**
   * True when a marker filter is active but no workspaces matched.
   */
  const noMatches = workspacesMarkerFilter != null && allGroups.length > 0 && groups.length === 0;

  /**
   * Workspace ids in on-screen list order for shift-click range selection.
   */
  const visibleOrder = useMemo(() => groups.map((group) => group.id), [groups]);

  const {
    selectionCount,
    selectedOrdered,
    clearSelection,
    handleRowClick,
    handleBeforeContextMenu,
    isSelected
  } = useSidebarRowSelection(visibleOrder, { selectionKey: 'tab-groups' });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  /**
   * Stable sortable ids for workspace rows.
   */
  const groupIds = useMemo(() => groups.map((group) => workspaceDragId(group.id)), [groups]);

  /**
   * Opens every request in the selected workspace.
   *
   * @param group - Workspace row to open.
   */
  const handleOpenGroup = useCallback(
    (group: Workspace): void => {
      void dispatch(requestOpenWorkspace(group.id));
    },
    [dispatch]
  );

  /**
   * Opens the workspace settings page tab for the given workspace.
   *
   * @param groupId - Workspace id to configure.
   */
  const handleConfigureWorkspace = useCallback(
    (groupId: number): void => {
      cancelPendingOpen();
      dispatch(openPageTab({ type: 'workspace', id: groupId }));
    },
    [cancelPendingOpen, dispatch]
  );

  /**
   * Schedules opening a workspace after a short delay so double-click can cancel it.
   *
   * @param group - Workspace row to open.
   */
  const scheduleOpenGroup = useCallback(
    (group: Workspace): void => {
      cancelPendingOpen();
      openClickTimerRef.current = setTimeout(() => {
        openClickTimerRef.current = null;
        handleOpenGroup(group);
      }, WORKSPACE_OPEN_CLICK_DELAY_MS);
    },
    [cancelPendingOpen, handleOpenGroup]
  );

  /**
   * Saves the current open tabs and layout into a workspace.
   *
   * @param group - Workspace to overwrite with the current UI snapshot.
   */
  const handleSaveGroup = useCallback(
    async (group: Workspace): Promise<void> => {
      try {
        await dispatch(saveWorkspace(group.id)).unwrap();
      } catch (err) {
        toast.error(formatErrorMessage(err, 'Failed to save workspace'));
      }
    },
    [dispatch]
  );

  /**
   * Deletes a workspace after confirmation.
   *
   * @param group - Workspace to delete.
   */
  const handleDeleteGroup = useCallback(
    async (group: Workspace): Promise<void> => {
      const confirmed = await confirm({
        title: 'Delete workspace',
        message: `Delete workspace "${group.name}"?`,
        confirmLabel: 'Delete',
        variant: 'danger'
      });
      if (confirmed) {
        void dispatch(deleteWorkspace(group.id));
      }
    },
    [confirm, dispatch]
  );

  /**
   * Deletes all currently multi-selected workspaces after confirmation.
   */
  const handleDeleteSelected = useCallback(async (): Promise<void> => {
    if (selectedOrdered.length === 0) {
      return;
    }

    const count = selectedOrdered.length;
    const confirmed = await confirm({
      title: 'Delete workspaces',
      message: `Delete ${count} selected workspace${count === 1 ? '' : 's'}?`,
      confirmLabel: 'Delete',
      variant: 'danger'
    });
    if (!confirmed) {
      return;
    }

    try {
      for (const id of selectedOrdered) {
        await dispatch(deleteWorkspace(id));
      }
      clearSelection();
    } catch (err) {
      showAlert(dispatch, formatErrorMessage(err, 'Failed to delete workspaces'));
    }
  }, [clearSelection, confirm, dispatch, selectedOrdered]);

  /**
   * Persists a new workspace order after drag-and-drop or menu moves.
   *
   * @param orderedWorkspaceIds - Workspace ids in desired order.
   */
  const onReorderWorkspaces = useCallback(
    async (orderedWorkspaceIds: number[]): Promise<void> => {
      await dispatch(reorderWorkspaces(orderedWorkspaceIds));
    },
    [dispatch]
  );

  /**
   * Moves a workspace one position up or down in the sidebar list.
   *
   * @param groupId - Workspace to move.
   * @param direction - Whether to move toward the top or bottom of the list.
   */
  const moveWorkspace = useCallback(
    async (groupId: number, direction: 'up' | 'down'): Promise<void> => {
      const ids = groups.map((group) => group.id);
      const index = ids.findIndex((id) => id === groupId);
      if (index < 0) return;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= ids.length) return;
      await onReorderWorkspaces(arrayMove(ids, index, targetIndex));
    },
    [groups, onReorderWorkspaces]
  );

  /**
   * Records the workspace being dragged for overlay preview.
   *
   * @param event - Drag start event from dnd-kit.
   */
  const handleDragStart = (event: DragStartEvent): void => {
    const groupId = parseWorkspaceDragId(String(event.active.id));
    if (groupId == null) return;
    const group = groups.find((item) => item.id === groupId) ?? null;
    setActiveDragGroup(group);
  };

  /**
   * Persists a new order when a workspace row is dropped.
   *
   * @param event - Drag end event from dnd-kit.
   */
  const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
    const { active, over } = event;
    if (!over) {
      setActiveDragGroup(null);
      return;
    }

    const activeId = parseWorkspaceDragId(String(active.id));
    const overId = parseWorkspaceDragId(String(over.id));
    if (activeId == null || overId == null || activeId === overId) {
      setActiveDragGroup(null);
      return;
    }

    const ids = groups.map((group) => group.id);
    const oldIndex = ids.findIndex((id) => id === activeId);
    const newIndex = ids.findIndex((id) => id === overId);
    if (oldIndex < 0 || newIndex < 0) {
      setActiveDragGroup(null);
      return;
    }

    const persist = onReorderWorkspaces(arrayMove(ids, oldIndex, newIndex));
    setActiveDragGroup(null);
    await persist;
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={(event) => void handleDragEnd(event)}
      onDragCancel={() => setActiveDragGroup(null)}
    >
      <div
        className="flex flex-col gap-0.5"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            clearSelection();
          }
        }}
      >
        {noMatches ? <div className="px-2 py-1.5 text-muted">No matching workspaces</div> : null}
        {!noMatches && groups.length === 0 ? <EmptySectionLabel label="No workspaces" /> : null}
        {groups.length > 0 ? (
          <SidebarListbox aria-label="Workspaces" multiselectable>
            <SortableContext items={groupIds} strategy={verticalListSortingStrategy}>
              {groups.map((group, groupIndex) => {
                const menuId = `tab-group-${group.id}`;
                const selected = isSelected(group.id);
                const showBulkMenu = selected && selectionCount > 1;

                return (
                  <SidebarWorkspaceItem
                    key={group.id}
                    name={group.name}
                    summary={workspaceSummaryText(group)}
                    icon={faWindowRestore}
                    selected={selected}
                    markerDot={{
                      marker: group.marker,
                      visible: showMarkers,
                      label: `Color marker for ${group.name}`
                    }}
                    sortable={{
                      id: workspaceDragId(group.id),
                      dragHandleLabel: `Reorder workspace "${group.name}"`,
                      disabled: workspacesMarkerFilter != null || sortActive
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleBeforeContextMenu(group.id);
                      setOpenMenuId(menuId);
                    }}
                    onClick={(event: MouseEvent<HTMLElement>) => {
                      handleRowClick(
                        group.id,
                        { shiftKey: event.shiftKey, ctrlOrMetaKey: event.ctrlKey || event.metaKey },
                        () => scheduleOpenGroup(group)
                      );
                    }}
                    onDoubleClick={() => handleConfigureWorkspace(group.id)}
                    onEnter={() => {
                      handleConfigureWorkspace(group.id);
                      focusWorkspaceSettings();
                    }}
                    actions={
                      showBulkMenu ? (
                        <RowActionsMenu
                          menuId={menuId}
                          openMenuId={openMenuId}
                          onOpenChange={setOpenMenuId}
                          triggerTabIndex={-1}
                          groups={[
                            [
                              {
                                label: 'Delete',
                                variant: 'danger' as const,
                                onSelect: () => {
                                  void handleDeleteSelected();
                                }
                              }
                            ]
                          ]}
                        />
                      ) : (
                        <SidebarRowActionsMenu
                          menuId={menuId}
                          openMenuId={openMenuId}
                          onOpenChange={setOpenMenuId}
                          markerTarget={{
                            kind: 'workspace',
                            id: group.id,
                            marker: group.marker ?? null
                          }}
                          groups={[
                            ...(sortActive
                              ? []
                              : buildReorderMenuGroup(
                                  groupIndex,
                                  groups.length,
                                  (direction) => void moveWorkspace(group.id, direction)
                                )),
                            [
                              {
                                label: 'Save',
                                onSelect: () => {
                                  void handleSaveGroup(group);
                                }
                              },
                              {
                                label: 'Settings',
                                onSelect: () => handleConfigureWorkspace(group.id)
                              },
                              {
                                label: 'Rename',
                                onSelect: () =>
                                  dispatch(
                                    openWorkspaceModal({
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
                                    openWorkspaceModal({
                                      mode: 'clone',
                                      groupId: group.id,
                                      name: `Copy of ${group.name}`
                                    })
                                  )
                              },
                              {
                                label: 'Export',
                                onSelect: () => {
                                  void dispatch(exportWorkspace(group.id));
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
                      )
                    }
                  />
                );
              })}
            </SortableContext>
          </SidebarListbox>
        ) : null}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDragGroup ? (
          <div className="rounded border border-separator bg-surface px-2 py-1 font-medium shadow-md">
            {activeDragGroup.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
