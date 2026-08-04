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
import { useCallback, useMemo, useState, type JSX, type MouseEvent, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import {
  buildEnvironmentTree,
  findNextSiblingEnvironment,
  reorderEnvironmentSiblingIds,
  type EnvironmentTreeNode
} from '@harborclient/core/environmentTree';
import type { Environment } from '@harborclient/core/types';
import {
  EmptySectionLabel,
  SidebarEnvironmentItem,
  SidebarListbox,
  SidebarTree,
  SidebarTreeGroup
} from '@harborclient/sdk/components';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { faChevronDown, faChevronRight } from '#/renderer/src/fontawesome';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectActiveEnvironmentId, selectEnvironments } from '#/renderer/src/store/selectors';
import { setActiveEnvironmentId } from '#/renderer/src/store/slices/environmentsSlice';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';
import {
  copyEnvironmentVariablesDown,
  deleteEnvironment,
  duplicateEnvironment,
  exportEnvironment,
  mergeEnvironmentDown,
  reorderEnvironments
} from '#/renderer/src/store/thunks';
import { useSidebarRowSelection } from '#/renderer/src/ui/Sidebars/CollectionSidebar/selection/useSidebarRowSelection';
import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/expansion/useSidebarExpansion';
import { useSidebarSectionFilter } from '#/renderer/src/ui/Sidebars/CollectionSidebar/filter/sidebarSectionFilterContext';
import { filterItemsByMarker } from '#/renderer/src/ui/Sidebars/CollectionSidebar/filter/sidebarMarkerFilter';
import {
  sortSidebarItems,
  toSortTimestamp
} from '#/renderer/src/ui/Sidebars/CollectionSidebar/sort/sidebarSort';
import { useSidebarSearchContext } from '#/renderer/src/ui/Sidebars/CollectionSidebar/search/sidebarSearchContext';
import { focusEnvironmentSettings } from '#/renderer/src/ui/Tabs/EnvironmentSettings/focusEnvironmentSettings';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/Modals/dialogHelpers';
import { type InspectPoint } from '#/renderer/src/ui/Shared/devInspectContextMenu';
import { AnimatedCollapse } from '#/renderer/src/ui/Shared/Animated/AnimatedCollapse';
import { ActionsMenu } from './ActionsMenu';
import { environmentDragId, environmentSummaryText, parseEnvironmentDragId } from './utils';

export { EnvironmentsHeaderActions } from './EnvironmentsHeaderActions';

/**
 * Collects environment ids currently visible in the nested tree (respecting expansion).
 *
 * @param nodes - Sibling tree nodes at the current level.
 * @param expandedIds - Environment ids whose children are expanded.
 * @returns Preorder ids for visible rows only.
 */
function collectVisibleEnvironmentIds(
  nodes: readonly EnvironmentTreeNode[],
  expandedIds: ReadonlySet<number>
): number[] {
  const ids: number[] = [];
  for (const node of nodes) {
    ids.push(node.environment.id);
    if (node.children.length > 0 && expandedIds.has(node.environment.id)) {
      ids.push(...collectVisibleEnvironmentIds(node.children, expandedIds));
    }
  }
  return ids;
}

/**
 * Environment list with active-row highlight, nested tree (default sort), drag
 * reordering among siblings, and row actions. Sources environments and the active
 * id from the store, respects the sidebar search and marker filters, and
 * dispatches its own environment actions.
 */
export function Environments(): JSX.Element {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const allEnvironments = useAppSelector(selectEnvironments);
  const activeEnvironmentId = useAppSelector(selectActiveEnvironmentId);
  const { searchFilter, searchActive } = useSidebarSearchContext();
  const { environmentsMarkerFilter } = useSidebarSectionFilter();
  const { showMarkers, sectionSort, expandedEnvironmentIds, toggleEnvironment } =
    useSidebarExpansion();
  const markerFilterActive = environmentsMarkerFilter != null;
  const sortMode = sectionSort.environments;
  const sortActive = sortMode !== 'default';
  const useTreeMode = !searchActive && !markerFilterActive && !sortActive;

  /**
   * Environments visible for the current sidebar search and marker filters,
   * then ordered by the Environments section sort mode (flat list mode).
   */
  const flatEnvironments = useMemo(() => {
    const searchMatched =
      searchFilter == null
        ? allEnvironments
        : allEnvironments.filter((environment) => searchFilter.environmentIds.has(environment.id));
    const filtered = filterItemsByMarker(searchMatched, environmentsMarkerFilter);
    return sortSidebarItems(filtered, sortMode, {
      name: (environment) => environment.name,
      createdAt: (environment) => toSortTimestamp(environment.created_at),
      marker: (environment) => environment.marker
    });
  }, [allEnvironments, environmentsMarkerFilter, searchFilter, sortMode]);

  /**
   * Nested environment tree used when default sort and no search/marker filter.
   */
  const environmentTree = useMemo((): EnvironmentTreeNode[] => {
    if (!useTreeMode) {
      return [];
    }
    return buildEnvironmentTree(allEnvironments);
  }, [allEnvironments, useTreeMode]);

  /**
   * True when search and/or marker filter is active but no environments matched.
   */
  const noMatches =
    (searchFilter != null || markerFilterActive) &&
    allEnvironments.length > 0 &&
    flatEnvironments.length === 0;

  /**
   * Environment ids in on-screen list order for shift-click range selection.
   */
  const visibleOrder = useMemo(() => {
    if (useTreeMode) {
      return collectVisibleEnvironmentIds(environmentTree, expandedEnvironmentIds);
    }
    return flatEnvironments.map((environment) => environment.id);
  }, [environmentTree, expandedEnvironmentIds, flatEnvironments, useTreeMode]);

  const {
    selectionCount,
    selectedOrdered,
    clearSelection,
    handleRowClick,
    handleBeforeContextMenu,
    isSelected
  } = useSidebarRowSelection(visibleOrder, { selectionKey: 'environments' });

  /**
   * Sets the active environment.
   *
   * @param id - Environment database id.
   */
  const onSelectEnvironment = (id: number): void => {
    dispatch(setActiveEnvironmentId(id));
  };

  /**
   * Opens the environment settings view.
   *
   * @param id - Environment database id.
   */
  const onConfigureEnvironment = (id: number): void => {
    dispatch(openPageTab({ type: 'environment', id }));
  };

  /**
   * Deletes an environment.
   *
   * @param id - Environment database id.
   */
  const onDeleteEnvironment = async (id: number): Promise<void> => {
    await dispatch(deleteEnvironment(id));
  };

  /**
   * Exports an environment to a JSON file.
   *
   * @param id - Environment database id.
   */
  const onExportEnvironment = async (id: number): Promise<void> => {
    const result = await dispatch(exportEnvironment(id)).unwrap();
    if (!result.canceled) {
      toast.success('Environment exported');
    }
  };

  /**
   * Duplicates an environment and its variables.
   *
   * @param id - Environment database id.
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
   * Copies missing variables from an environment into its next sibling.
   *
   * @param id - Source environment database id.
   */
  const onCopyEnvironmentVariablesDown = async (id: number): Promise<void> => {
    try {
      const { addedCount } = await dispatch(copyEnvironmentVariablesDown(id)).unwrap();
      if (addedCount === 0) {
        toast('No new variables to copy');
        return;
      }
      toast.success(`${addedCount} variable${addedCount === 1 ? '' : 's'} copied`);
    } catch (err) {
      showAlert(dispatch, formatErrorMessage(err, 'Failed to copy variables down'));
    }
  };

  /**
   * Merges an environment into its next sibling.
   *
   * @param id - Source environment database id.
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
   *
   * @param orderedEnvironmentIds - Full environment id list in sidebar preorder.
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
   * Stable sortable ids for flat-list environment rows.
   */
  const flatEnvironmentIds = useMemo(
    () => flatEnvironments.map((environment) => environmentDragId(environment.id)),
    [flatEnvironments]
  );

  /**
   * Moves an environment one position among its siblings (tree) or flat neighbors.
   *
   * @param environmentId - Environment to move.
   * @param direction - Whether to move toward the top or bottom of the sibling list.
   * @param siblingIds - Ordered sibling ids for the move group.
   * @param parentUuid - Parent uuid of the sibling group (`null` for roots); ignored in flat mode.
   */
  const moveEnvironmentAmong = async (
    environmentId: number,
    direction: 'up' | 'down',
    siblingIds: number[],
    parentUuid: string | null
  ): Promise<void> => {
    const index = siblingIds.findIndex((id) => id === environmentId);
    if (index < 0) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= siblingIds.length) return;
    const nextSiblingIds = arrayMove(siblingIds, index, targetIndex);

    if (useTreeMode) {
      const orderedIds = reorderEnvironmentSiblingIds(environmentTree, parentUuid, nextSiblingIds);
      await onReorderEnvironments(orderedIds);
      return;
    }

    await onReorderEnvironments(
      arrayMove(
        flatEnvironments.map((e) => e.id),
        index,
        targetIndex
      )
    );
  };

  /**
   * Records the environment being dragged for overlay preview.
   *
   * @param event - Drag start event from dnd-kit.
   */
  const handleDragStart = (event: DragStartEvent): void => {
    const environmentId = parseEnvironmentDragId(String(event.active.id));
    if (environmentId == null) return;
    const environment = allEnvironments.find((item) => item.id === environmentId) ?? null;
    setActiveDragEnvironment(environment);
  };

  /**
   * Persists a new sibling (or flat) order when an environment row is dropped.
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

    if (useTreeMode) {
      const activeEnv = allEnvironments.find((item) => item.id === activeId);
      const overEnv = allEnvironments.find((item) => item.id === overId);
      if (!activeEnv || !overEnv) {
        setActiveDragEnvironment(null);
        return;
      }

      const activeParent = activeEnv.parentUuid?.trim() || null;
      const overParent = overEnv.parentUuid?.trim() || null;
      if (activeParent !== overParent) {
        setActiveDragEnvironment(null);
        return;
      }

      const siblings = allEnvironments.filter(
        (entry) => (entry.parentUuid?.trim() || null) === activeParent
      );
      const siblingIds = siblings.map((entry) => entry.id);
      const oldIndex = siblingIds.findIndex((id) => id === activeId);
      const newIndex = siblingIds.findIndex((id) => id === overId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
        setActiveDragEnvironment(null);
        return;
      }

      const nextSiblingIds = arrayMove(siblingIds, oldIndex, newIndex);
      const orderedIds = reorderEnvironmentSiblingIds(
        environmentTree,
        activeParent,
        nextSiblingIds
      );
      const persist = onReorderEnvironments(orderedIds);
      setActiveDragEnvironment(null);
      await persist;
      return;
    }

    const ids = flatEnvironments.map((environment) => environment.id);
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

  /**
   * Builds the actions menu and interaction handlers for one environment row.
   *
   * @param environment - Environment for the row.
   * @param environmentIndex - Zero-based index among siblings (or flat list).
   * @param environmentsCount - Sibling (or flat list) count for reorder bounds.
   * @param parentUuid - Parent uuid for sibling moves (`null` for roots / flat).
   * @param siblingIds - Ordered sibling ids for move up/down.
   */
  const renderEnvironmentActions = (
    environment: Environment,
    environmentIndex: number,
    environmentsCount: number,
    parentUuid: string | null,
    siblingIds: number[]
  ): ReactNode => {
    const multiSelected = isSelected(environment.id);
    const showBulkMenu = multiSelected && selectionCount > 1;
    const nextSibling = findNextSiblingEnvironment(environment.id, allEnvironments);
    const childrenCount = allEnvironments.filter(
      (entry) => (entry.parentUuid?.trim() || null) === environment.uuid
    ).length;
    const menuId = `environment-${environment.id}`;

    return (
      <ActionsMenu
        environment={environment}
        environmentIndex={environmentIndex}
        environmentsCount={environmentsCount}
        environmentBelowName={nextSibling?.name}
        environmentBelowVariables={nextSibling?.variables}
        childrenCount={childrenCount}
        showBulkMenu={showBulkMenu}
        openMenuId={openMenuId}
        onOpenChange={setOpenMenuId}
        inspectPoint={inspectPointsByMenuId[menuId]}
        reorderEnabled={useTreeMode || (!searchActive && !markerFilterActive && !sortActive)}
        onMove={(direction) =>
          void moveEnvironmentAmong(environment.id, direction, siblingIds, parentUuid)
        }
        onConfigure={() => onConfigureEnvironment(environment.id)}
        onExport={() => void onExportEnvironment(environment.id)}
        onDuplicate={() => void onDuplicateEnvironment(environment.id)}
        onCopyDown={() => void onCopyEnvironmentVariablesDown(environment.id)}
        onMergeDown={() => void onMergeEnvironmentDown(environment.id)}
        onDelete={() => void onDeleteEnvironment(environment.id)}
        onDeleteSelected={() => void handleDeleteSelected()}
      />
    );
  };

  /**
   * Renders one environment row with selection, configure, and context-menu wiring.
   *
   * @param environment - Environment for the row.
   * @param options - Tree/flat presentation options for the row.
   */
  const renderEnvironmentRow = (
    environment: Environment,
    options: {
      environmentIndex: number;
      environmentsCount: number;
      parentUuid: string | null;
      siblingIds: number[];
      hasChildren?: boolean;
      expanded?: boolean;
      childrenId?: string;
      level?: number;
      reorderDisabled: boolean;
      subtree?: ReactNode;
    }
  ): JSX.Element => {
    const isActive = activeEnvironmentId === environment.id;
    const multiSelected = isSelected(environment.id);
    const rowHighlighted = isActive || multiSelected;
    const variableSummary = environmentSummaryText(environment.variables);
    const menuId = `environment-${environment.id}`;
    const {
      environmentIndex,
      environmentsCount,
      parentUuid,
      siblingIds,
      hasChildren = false,
      expanded = false,
      childrenId,
      level,
      reorderDisabled,
      subtree
    } = options;

    return (
      <SidebarEnvironmentItem
        key={environment.id}
        name={environment.name}
        variableSummary={variableSummary}
        selected={rowHighlighted}
        ariaCurrent={isActive}
        ariaSelected={multiSelected}
        ariaLabel={`${environment.name}, ${variableSummary}`}
        dataSidebarEnvironmentId={environment.id}
        hasChildren={hasChildren}
        expanded={expanded}
        childrenId={childrenId}
        level={level}
        setSize={environmentsCount}
        posInSet={environmentIndex + 1}
        expandIcon={faChevronRight}
        collapseIcon={faChevronDown}
        onToggleExpand={hasChildren ? () => toggleEnvironment(environment.id) : undefined}
        markerDot={{
          marker: environment.marker,
          visible: showMarkers,
          label: `Color marker for ${environment.name}`
        }}
        sortable={{
          id: environmentDragId(environment.id),
          dragHandleLabel: `Reorder environment "${environment.name}"`,
          disabled: reorderDisabled
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          handleBeforeContextMenu(environment.id);
          setInspectPointsByMenuId((prev) => ({
            ...prev,
            [menuId]: { x: event.clientX, y: event.clientY }
          }));
          setOpenMenuId(menuId);
        }}
        onClick={(event: MouseEvent<HTMLElement>) => {
          handleRowClick(
            environment.id,
            { shiftKey: event.shiftKey, ctrlOrMetaKey: event.ctrlKey || event.metaKey },
            () => onSelectEnvironment(environment.id)
          );
        }}
        onDoubleClick={() => onConfigureEnvironment(environment.id)}
        onEnter={() => {
          onConfigureEnvironment(environment.id);
          focusEnvironmentSettings();
        }}
        actions={renderEnvironmentActions(
          environment,
          environmentIndex,
          environmentsCount,
          parentUuid,
          siblingIds
        )}
        subtree={subtree}
      />
    );
  };

  /**
   * Recursively renders nested environment sibling groups with parent-scoped sorting.
   *
   * @param nodes - Sibling tree nodes at the current level.
   * @param level - Nesting depth (`0` = roots).
   * @param parentUuid - Parent uuid for this sibling group (`null` for roots).
   * @returns Sortable sibling group markup.
   */
  const renderEnvironmentNodes = (
    nodes: readonly EnvironmentTreeNode[],
    level: number,
    parentUuid: string | null
  ): ReactNode => {
    const siblingIds = nodes.map((node) => node.environment.id);
    const sortableIds = siblingIds.map((id) => environmentDragId(id));

    return (
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        {nodes.map((node, index) => {
          const { environment, children } = node;
          const hasChildren = children.length > 0;
          const expanded = expandedEnvironmentIds.has(environment.id);
          const childrenId = `sidebar-environment-children-${environment.id}`;

          return renderEnvironmentRow(environment, {
            environmentIndex: index,
            environmentsCount: nodes.length,
            parentUuid,
            siblingIds,
            hasChildren,
            expanded,
            childrenId: hasChildren ? childrenId : undefined,
            level,
            reorderDisabled: false,
            subtree: hasChildren ? (
              <AnimatedCollapse open={expanded}>
                <SidebarTreeGroup id={childrenId}>
                  {renderEnvironmentNodes(children, level + 1, environment.uuid)}
                </SidebarTreeGroup>
              </AnimatedCollapse>
            ) : undefined
          });
        })}
      </SortableContext>
    );
  };

  const emptyLabel =
    noMatches && allEnvironments.length > 0 ? (
      <div className="px-2 py-1.5 text-muted">No matching environments</div>
    ) : !noMatches && allEnvironments.length === 0 ? (
      <EmptySectionLabel label="No environments" />
    ) : null;

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
        {emptyLabel}

        {useTreeMode && environmentTree.length > 0 ? (
          <SidebarTree aria-label="Environments">
            {renderEnvironmentNodes(environmentTree, 0, null)}
          </SidebarTree>
        ) : null}

        {!useTreeMode && flatEnvironments.length > 0 ? (
          <SidebarListbox aria-label="Environments" multiselectable>
            <SortableContext items={flatEnvironmentIds} strategy={verticalListSortingStrategy}>
              {flatEnvironments.map((environment, environmentIndex) =>
                renderEnvironmentRow(environment, {
                  environmentIndex,
                  environmentsCount: flatEnvironments.length,
                  parentUuid: null,
                  siblingIds: flatEnvironments.map((entry) => entry.id),
                  reorderDisabled: searchActive || markerFilterActive || sortActive
                })
              )}
            </SortableContext>
          </SidebarListbox>
        ) : null}
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
