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
import { useCallback, useMemo, useState, type JSX, type MouseEvent } from 'react';
import toast from 'react-hot-toast';
import type { Environment } from '#/shared/types';
import { RowActionsMenu } from '@harborclient/sdk/components';
import { buildReorderMenuGroup } from '@harborclient/sdk/components';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectActiveEnvironmentId, selectEnvironments } from '#/renderer/src/store/selectors';
import { setActiveEnvironmentId } from '#/renderer/src/store/slices/environmentsSlice';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';
import {
  deleteEnvironment,
  duplicateEnvironment,
  exportEnvironment,
  mergeEnvironmentDown,
  reorderEnvironments
} from '#/renderer/src/store/thunks';
import { SortableRow } from '#/renderer/src/ui/sidebars/CollectionSidebar/Collections/SortableRow';
import { stopSortableDragPointerDown } from '#/renderer/src/ui/sidebars/CollectionSidebar/Collections/sortableRowUtils';
import { useSidebarRowSelection } from '#/renderer/src/ui/sidebars/CollectionSidebar/useSidebarRowSelection';
import { useSidebarSearchContext } from '#/renderer/src/ui/sidebars/CollectionSidebar/sidebarSearchContext';
import { focusEnvironmentSettings } from '#/renderer/src/ui/EnvironmentSettings/focusEnvironmentSettings';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/modals/dialogHelpers';
import { sourceRow } from '#/renderer/src/ui/shared/classes';
import {
  buildDevInspectMenuGroups,
  useDeveloperToolsEnabled,
  type InspectPoint
} from '#/renderer/src/ui/shared/devInspectContextMenu';
import { environmentDragId, environmentSummaryText, parseEnvironmentDragId } from './utils';

/**
 * Environment list with active-row highlight, drag reordering, and row actions.
 * Sources environments and the active id from the store, respects the sidebar
 * search filter, and dispatches its own environment actions.
 */
export function Environments(): JSX.Element {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const allEnvironments = useAppSelector(selectEnvironments);
  const activeEnvironmentId = useAppSelector(selectActiveEnvironmentId);
  const { searchFilter, searchActive } = useSidebarSearchContext();

  /**
   * Environments visible for the current sidebar search filter.
   */
  const environments = useMemo(() => {
    if (searchFilter == null) {
      return allEnvironments;
    }
    return allEnvironments.filter((environment) => searchFilter.environmentIds.has(environment.id));
  }, [allEnvironments, searchFilter]);

  /**
   * True when search is active but no environments matched the query.
   */
  const noMatches = searchFilter != null && allEnvironments.length > 0 && environments.length === 0;

  /**
   * Environment ids in on-screen list order for shift-click range selection.
   */
  const visibleOrder = useMemo(
    () => environments.map((environment) => environment.id),
    [environments]
  );

  const {
    selectionCount,
    selectedOrdered,
    clearSelection,
    handleRowClick,
    handleBeforeContextMenu,
    isSelected
  } = useSidebarRowSelection(visibleOrder);

  /**
   * Sets the active environment.
   */
  const onSelectEnvironment = (id: number): void => {
    dispatch(setActiveEnvironmentId(id));
  };

  /**
   * Opens the environment settings view.
   */
  const onConfigureEnvironment = (id: number): void => {
    dispatch(openPageTab({ type: 'environment', id }));
  };

  /**
   * Deletes an environment.
   */
  const onDeleteEnvironment = async (id: number): Promise<void> => {
    await dispatch(deleteEnvironment(id));
  };

  /**
   * Exports an environment to a JSON file.
   */
  const onExportEnvironment = async (id: number): Promise<void> => {
    const result = await dispatch(exportEnvironment(id)).unwrap();
    if (!result.canceled) {
      toast.success('Environment exported');
    }
  };

  /**
   * Duplicates an environment and its variables.
   */
  const onDuplicateEnvironment = async (id: number): Promise<void> => {
    try {
      await dispatch(duplicateEnvironment(id)).unwrap();
      toast.success('Environment duplicated');
    } catch (err) {
      showAlert(dispatch, formatErrorMessage(err, 'Failed to duplicate environment'));
    }
  };

  /**
   * Merges an environment into the one directly below it.
   */
  const onMergeEnvironmentDown = async (id: number): Promise<void> => {
    try {
      await dispatch(mergeEnvironmentDown(id)).unwrap();
      toast.success('Environments merged');
    } catch (err) {
      showAlert(dispatch, formatErrorMessage(err, 'Failed to merge environments'));
    }
  };

  /**
   * Persists a new environment order after drag-and-drop or menu moves.
   */
  const onReorderEnvironments = async (orderedEnvironmentIds: number[]): Promise<void> => {
    await dispatch(reorderEnvironments({ orderedEnvironmentIds }));
  };

  /**
   * Deletes all currently multi-selected environments after confirmation.
   */
  const handleDeleteSelected = useCallback(async (): Promise<void> => {
    if (selectedOrdered.length === 0) {
      return;
    }

    const count = selectedOrdered.length;
    const confirmed = await confirm({
      title: 'Delete environments',
      message: `Delete ${count} selected environment${count === 1 ? '' : 's'}?`,
      confirmLabel: 'Delete',
      variant: 'danger'
    });
    if (!confirmed) {
      return;
    }

    try {
      for (const id of selectedOrdered) {
        await dispatch(deleteEnvironment(id));
      }
      clearSelection();
    } catch (err) {
      showAlert(dispatch, formatErrorMessage(err, 'Failed to delete environments'));
    }
  }, [clearSelection, confirm, dispatch, selectedOrdered]);

  const developerToolsEnabled = useDeveloperToolsEnabled();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [inspectPointsByMenuId, setInspectPointsByMenuId] = useState<Record<string, InspectPoint>>(
    {}
  );
  const [activeDragEnvironment, setActiveDragEnvironment] = useState<Environment | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  /**
   * Stable sortable ids for environment rows.
   */
  const environmentIds = useMemo(
    () => environments.map((environment) => environmentDragId(environment.id)),
    [environments]
  );

  /**
   * Moves an environment one position up or down in the sidebar list.
   *
   * @param environmentId - Environment to move.
   * @param direction - Whether to move toward the top or bottom of the list.
   */
  const moveEnvironment = async (
    environmentId: number,
    direction: 'up' | 'down'
  ): Promise<void> => {
    const ids = environments.map((environment) => environment.id);
    const index = ids.findIndex((id) => id === environmentId);
    if (index < 0) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= ids.length) return;
    await onReorderEnvironments(arrayMove(ids, index, targetIndex));
  };

  /**
   * Records the environment being dragged for overlay preview.
   *
   * @param event - Drag start event from dnd-kit.
   */
  const handleDragStart = (event: DragStartEvent): void => {
    const environmentId = parseEnvironmentDragId(String(event.active.id));
    if (environmentId == null) return;
    const environment = environments.find((item) => item.id === environmentId) ?? null;
    setActiveDragEnvironment(environment);
  };

  /**
   * Persists a new order when an environment row is dropped.
   *
   * @param event - Drag end event from dnd-kit.
   */
  const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
    const { active, over } = event;
    if (!over) {
      setActiveDragEnvironment(null);
      return;
    }

    const activeId = parseEnvironmentDragId(String(active.id));
    const overId = parseEnvironmentDragId(String(over.id));
    if (activeId == null || overId == null || activeId === overId) {
      setActiveDragEnvironment(null);
      return;
    }

    const ids = environments.map((environment) => environment.id);
    const oldIndex = ids.findIndex((id) => id === activeId);
    const newIndex = ids.findIndex((id) => id === overId);
    if (oldIndex < 0 || newIndex < 0) {
      setActiveDragEnvironment(null);
      return;
    }

    const persist = onReorderEnvironments(arrayMove(ids, oldIndex, newIndex));
    setActiveDragEnvironment(null);
    await persist;
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={(event) => void handleDragEnd(event)}
      onDragCancel={() => setActiveDragEnvironment(null)}
    >
      <div
        className="sidebar-source-list flex flex-col gap-0"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            clearSelection();
          }
        }}
      >
        {noMatches && <div className="px-2 py-1.5 text-muted">No matching environments</div>}
        {!noMatches && environments.length === 0 && (
          <div className="px-2 py-1.5 text-muted">No environments yet</div>
        )}

        <SortableContext items={environmentIds} strategy={verticalListSortingStrategy}>
          {environments.map((environment, environmentIndex) => {
            const isActive = activeEnvironmentId === environment.id;
            const multiSelected = isSelected(environment.id);
            const rowHighlighted = isActive || multiSelected;
            const showBulkMenu = multiSelected && selectionCount > 1;
            const environmentBelow = environments[environmentIndex + 1];
            const variableSummary = environmentSummaryText(environment.variables);
            const menuId = `environment-${environment.id}`;

            return (
              <SortableRow
                key={environment.id}
                id={environmentDragId(environment.id)}
                className={sourceRow(rowHighlighted, true)}
                dragHandleLabel={`Reorder environment "${environment.name}"`}
                disabled={searchActive}
                onRowContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleBeforeContextMenu(environment.id);
                  setInspectPointsByMenuId((prev) => ({
                    ...prev,
                    [menuId]: { x: event.clientX, y: event.clientY }
                  }));
                  setOpenMenuId(menuId);
                }}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 border-none bg-transparent py-0 text-left text-inherit app-no-drag"
                  data-sidebar-environment-id={environment.id}
                  aria-current={isActive ? 'true' : undefined}
                  aria-selected={multiSelected ? 'true' : undefined}
                  aria-label={`${environment.name}, ${variableSummary}`}
                  onClick={(event: MouseEvent<HTMLButtonElement>) => {
                    handleRowClick(
                      environment.id,
                      { shiftKey: event.shiftKey, ctrlOrMetaKey: event.ctrlKey || event.metaKey },
                      () => onSelectEnvironment(environment.id)
                    );
                  }}
                  onDoubleClick={() => onConfigureEnvironment(environment.id)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    onConfigureEnvironment(environment.id);
                    focusEnvironmentSettings();
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{environment.name}</span>
                  <span className="shrink-0 text-muted">{variableSummary}</span>
                </button>
                <div className="shrink-0" onPointerDown={stopSortableDragPointerDown}>
                  <RowActionsMenu
                    menuId={menuId}
                    openMenuId={openMenuId}
                    onOpenChange={setOpenMenuId}
                    groups={
                      showBulkMenu
                        ? [
                            [
                              {
                                label: 'Delete',
                                variant: 'danger' as const,
                                onSelect: () => {
                                  void handleDeleteSelected();
                                }
                              }
                            ]
                          ]
                        : [
                            ...buildReorderMenuGroup(
                              environmentIndex,
                              environments.length,
                              (direction) => void moveEnvironment(environment.id, direction)
                            ),
                            [
                              {
                                label: 'Settings',
                                onSelect: () => onConfigureEnvironment(environment.id)
                              },
                              {
                                label: 'Export',
                                onSelect: () => onExportEnvironment(environment.id)
                              },
                              {
                                label: 'Duplicate',
                                onSelect: () => void onDuplicateEnvironment(environment.id)
                              },
                              ...(environmentBelow
                                ? [
                                    {
                                      label: 'Merge down',
                                      onSelect: () => {
                                        void (async () => {
                                          const confirmed = await confirm({
                                            title: 'Merge environment down',
                                            message: `Merge "${environment.name}" into "${environmentBelow.name}"? The merged environment will be named "${environment.name}".`,
                                            confirmLabel: 'Merge down'
                                          });
                                          if (confirmed) {
                                            void onMergeEnvironmentDown(environment.id);
                                          }
                                        })();
                                      }
                                    }
                                  ]
                                : [])
                            ],
                            [
                              {
                                label: 'Delete',
                                variant: 'danger',
                                onSelect: () => {
                                  void (async () => {
                                    const confirmed = await confirm({
                                      title: 'Delete environment',
                                      message: `Delete environment "${environment.name}"?`,
                                      confirmLabel: 'Delete',
                                      variant: 'danger'
                                    });
                                    if (confirmed) {
                                      void onDeleteEnvironment(environment.id);
                                    }
                                  })();
                                }
                              }
                            ],
                            ...buildDevInspectMenuGroups(
                              inspectPointsByMenuId[menuId],
                              menuId,
                              developerToolsEnabled
                            )
                          ]
                    }
                  />
                </div>
              </SortableRow>
            );
          })}
        </SortableContext>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDragEnvironment ? (
          <div className="rounded border border-separator bg-surface px-2 py-1 font-medium shadow-md">
            {activeDragEnvironment.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
