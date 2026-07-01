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
import { useMemo, useState, type JSX } from 'react';
import type { Environment } from '#/shared/types';
import { RowActionsMenu } from '@harborclient/sdk/components';
import { buildReorderMenuGroup } from '@harborclient/sdk/components';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { SortableRow } from '#/renderer/src/ui/Sidebar/Collections/SortableRow';
import { sourceRow } from '#/renderer/src/ui/shared/classes';

interface Props {
  /**
   * All saved environments in sidebar display order.
   */
  environments: Environment[];

  /**
   * ID of the active environment, or null when none is selected.
   */
  activeEnvironmentId: number | null;

  /**
   * Called when the user selects an environment.
   */
  onSelectEnvironment: (id: number) => void;

  /**
   * Opens the environment settings view.
   */
  onConfigureEnvironment: (id: number) => void;

  /**
   * Deletes an environment.
   */
  onDeleteEnvironment: (id: number) => Promise<void>;

  /**
   * Exports an environment to a JSON file.
   */
  onExportEnvironment: (id: number) => void;

  /**
   * Duplicates an environment and its variables.
   */
  onDuplicateEnvironment: (id: number) => Promise<void>;

  /**
   * Persists a new environment order after drag-and-drop or menu moves.
   */
  onReorderEnvironments: (orderedEnvironmentIds: number[]) => Promise<void> | void;

  /**
   * When true, renders rows without drag-and-drop reordering.
   */
  searchActive?: boolean;

  /**
   * When true, shows a no-match message instead of an empty list.
   */
  noMatches?: boolean;
}

/**
 * Builds a stable dnd-kit id for an environment row.
 *
 * @param id - Environment database id.
 */
function environmentDragId(id: number): string {
  return `environment:${id}`;
}

/**
 * Parses an environment drag id back to its numeric id.
 *
 * @param dragId - Sortable id from dnd-kit.
 */
function parseEnvironmentDragId(dragId: string): number | null {
  const match = /^environment:(\d+)$/.exec(dragId);
  return match ? Number(match[1]) : null;
}

/**
 * Environment list with active-row highlight, drag reordering, and row actions.
 */
export function Environments({
  environments,
  activeEnvironmentId,
  onSelectEnvironment,
  onConfigureEnvironment,
  onDeleteEnvironment,
  onExportEnvironment,
  onDuplicateEnvironment,
  onReorderEnvironments,
  searchActive = false,
  noMatches = false
}: Props): JSX.Element {
  const confirm = useConfirm();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
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
    setActiveDragEnvironment(null);
    if (!over) return;

    const activeId = parseEnvironmentDragId(String(active.id));
    const overId = parseEnvironmentDragId(String(over.id));
    if (activeId == null || overId == null || activeId === overId) return;

    const ids = environments.map((environment) => environment.id);
    const oldIndex = ids.findIndex((id) => id === activeId);
    const newIndex = ids.findIndex((id) => id === overId);
    if (oldIndex < 0 || newIndex < 0) return;

    await onReorderEnvironments(arrayMove(ids, oldIndex, newIndex));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={(event) => void handleDragEnd(event)}
      onDragCancel={() => setActiveDragEnvironment(null)}
    >
      <div className="sidebar-source-list flex flex-col gap-0">
        {noMatches && (
          <div className="px-2 py-1.5 text-[14px] text-muted">No matching environments</div>
        )}
        {!noMatches && environments.length === 0 && (
          <div className="px-2 py-1.5 text-[14px] text-muted">No environments yet</div>
        )}

        <SortableContext items={environmentIds} strategy={verticalListSortingStrategy}>
          {environments.map((environment, environmentIndex) => {
            const selected = activeEnvironmentId === environment.id;

            return (
              <SortableRow
                key={environment.id}
                id={environmentDragId(environment.id)}
                className={sourceRow(selected, true)}
                dragHandleLabel={`Reorder environment "${environment.name}"`}
                disabled={searchActive}
                compact
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 cursor-pointer truncate border-none bg-transparent py-0 text-left text-[14px] text-inherit app-no-drag"
                  aria-current={selected ? 'true' : undefined}
                  onClick={() => onSelectEnvironment(environment.id)}
                  onDoubleClick={() => onConfigureEnvironment(environment.id)}
                >
                  {environment.name}
                </button>
                <RowActionsMenu
                  menuId={`environment-${environment.id}`}
                  openMenuId={openMenuId}
                  onOpenChange={setOpenMenuId}
                  groups={[
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
                      }
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
                    ]
                  ]}
                />
              </SortableRow>
            );
          })}
        </SortableContext>
      </div>

      <DragOverlay>
        {activeDragEnvironment ? (
          <div className="rounded border border-separator bg-surface px-2 py-1 text-[14px] font-medium shadow-md">
            {activeDragEnvironment.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
