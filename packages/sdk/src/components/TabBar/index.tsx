import {
  DndContext as DndContextBase,
  type DragEndEvent,
  DragOverlay as DragOverlayBase,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  rectSortingStrategy,
  sortableKeyboardCoordinates
} from '@dnd-kit/sortable';
import { useEffect, useMemo, useState } from '@harborclient/sdk/react';
import type { ComponentProps, JSX, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import type { MenuItem } from '../RowActionsMenu/index.js';
import { cn, resolveTabListKeyAction } from '../utils.js';
import { ClosingTabShell } from './ClosingTabShell.js';
import { TabBarShell } from './TabBarShell.js';
import { TabContextMenu } from './TabContextMenu.js';
import { TabNewButton } from './TabNewButton.js';
import type { TabBarItem, TabBarNewTab, TabBarSortableCursor } from './types.js';
import { useExitingTabItems } from './useExitingTabItems.js';

/**
 * Bridges dnd-kit components to the SDK JSX runtime element typing.
 */
type JsxBridgeComponent<P> = (props: P) => JSX.Element;

const DndContext = DndContextBase as unknown as JsxBridgeComponent<
  ComponentProps<typeof DndContextBase>
>;
const DragOverlay = DragOverlayBase as unknown as JsxBridgeComponent<
  ComponentProps<typeof DragOverlayBase>
>;

interface TabContextMenuState<TId extends string | number> {
  /**
   * Tab that was right-clicked.
   */
  targetId: TId;

  /**
   * Viewport X coordinate for the menu.
   */
  x: number;

  /**
   * Viewport Y coordinate for the menu.
   */
  y: number;
}

interface Props<TId extends string | number> {
  /**
   * Open tabs to render in display order.
   */
  tabs: TabBarItem<TId>[];

  /**
   * ID of the currently active tab.
   */
  activeId: TId;

  /**
   * When true, tabs wrap to multiple rows; otherwise they scroll horizontally.
   */
  wrap: boolean;

  /**
   * Accessible name for the tab list.
   */
  ariaLabel: string;

  /**
   * Prefix for tab element ids (for example `request-tab-`).
   */
  tabIdPrefix: string;

  /**
   * Prefix for linked tab panel ids (for example `request-tabpanel-`).
   */
  panelIdPrefix: string;

  /**
   * Prefix for dnd-kit sortable ids. Defaults to `${tabIdPrefix}sort:`.
   */
  sortablePrefix?: string;

  /**
   * Configuration for the new-tab control.
   */
  newTab: TabBarNewTab;

  /**
   * Called when the user selects a tab.
   */
  onSelect: (id: TId) => void;

  /**
   * Called when the user closes a tab.
   */
  onClose: (id: TId) => void;

  /**
   * Persists a new tab order after drag-and-drop reordering.
   */
  onReorder: (orderedIds: TId[]) => void;

  /**
   * Builds grouped context menu entries when a tab is right-clicked.
   */
  buildContextMenuGroups?: (targetId: TId, orderedIds: TId[]) => MenuItem[][];

  /**
   * When ArrowDown is pressed on a focused tab, returns true if focus moved into
   * the linked panel (for example request editor content).
   */
  onArrowDownIntoPanel?: (id: TId) => boolean;

  /**
   * Focuses the tab control for keyboard navigation and focus restoration.
   */
  onFocusTab?: (id: TId) => void;

  /**
   * Wraps the tab row for horizontal scrolling. Defaults to overflow-x-auto.
   */
  renderScrollContainer?: (row: ReactNode) => ReactNode;

  /**
   * Maximum width class applied to each tab shell.
   */
  maxTabWidthClass?: string;

  /**
   * Cursor style when sortable drag is enabled.
   */
  sortableCursor?: TabBarSortableCursor;

  /**
   * Additional classes for the outer tab bar container.
   */
  className?: string;
}

/**
 * Builds a stable dnd-kit sortable id for a tab row.
 *
 * @param prefix - Sortable id prefix.
 * @param id - Open tab id.
 */
function tabSortableId<TId extends string | number>(prefix: string, id: TId): string {
  return `${prefix}${String(id)}`;
}

/**
 * Parses a sortable drag id back to its tab id string.
 *
 * @param prefix - Sortable id prefix.
 * @param dragId - Sortable id from dnd-kit.
 */
function parseTabSortableId(prefix: string, dragId: string): string | null {
  if (!dragId.startsWith(prefix)) {
    return null;
  }
  return dragId.slice(prefix.length);
}

/**
 * Resolves the tab list index for arrow-key navigation from keyboard focus.
 *
 * @param tabs - Open tabs in display order.
 * @param activeId - Currently selected tab id.
 * @param tabIdPrefix - Prefix for tab element ids.
 * @returns Index into `tabs`, or `-1` when the list is empty.
 */
function resolveFocusedTabIndex<TId extends string | number>(
  tabs: TabBarItem<TId>[],
  activeId: TId,
  tabIdPrefix: string
): number {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement) {
    const tabElement = activeElement.closest('[role="tab"]');
    if (tabElement instanceof HTMLElement && tabElement.id.startsWith(tabIdPrefix)) {
      const tabId = tabElement.id.slice(tabIdPrefix.length);
      const focusedIndex = tabs.findIndex((tab) => String(tab.id) === tabId);
      if (focusedIndex >= 0) {
        return focusedIndex;
      }
    }
  }

  return tabs.findIndex((tab) => tab.id === activeId);
}

/**
 * Document-style tab bar with drag reorder, keyboard navigation, close animation,
 * optional context menu, and a new-tab control.
 */
export function TabBar<TId extends string | number>({
  tabs,
  activeId,
  wrap,
  ariaLabel,
  tabIdPrefix,
  panelIdPrefix,
  sortablePrefix,
  newTab,
  onSelect,
  onClose,
  onReorder,
  buildContextMenuGroups,
  onArrowDownIntoPanel,
  onFocusTab,
  renderScrollContainer,
  maxTabWidthClass,
  sortableCursor,
  className
}: Props<TId>): JSX.Element {
  const resolvedSortablePrefix = sortablePrefix ?? `${tabIdPrefix}sort:`;
  const [activeDragId, setActiveDragId] = useState<TId | null>(null);
  const [contextMenu, setContextMenu] = useState<TabContextMenuState<TId> | null>(null);

  const getId = useMemo(
    () =>
      (item: TabBarItem<TId>): TId =>
        item.id,
    []
  );
  const sortableEnabled = tabs.length >= 2;
  const { completeExit, getExitingBefore, removedIds } = useExitingTabItems(tabs, getId);

  /**
   * Stable sortable ids for open tabs.
   */
  const sortableIds = useMemo(
    () => tabs.map((tab) => tabSortableId(resolvedSortablePrefix, tab.id)),
    [tabs, resolvedSortablePrefix]
  );

  /**
   * Stable tab ids in display order for context menu close actions.
   */
  const orderedIds = useMemo(() => tabs.map((tab) => tab.id), [tabs]);

  /**
   * Menu groups for the open tab context menu, when one is visible.
   */
  const contextMenuGroups = useMemo(() => {
    if (contextMenu == null || buildContextMenuGroups == null) {
      return [];
    }

    return buildContextMenuGroups(contextMenu.targetId, orderedIds);
  }, [buildContextMenuGroups, contextMenu, orderedIds]);

  /**
   * Moves focus to the active tab when the focused tab row was just removed.
   */
  useEffect(() => {
    if (removedIds.length === 0 || onFocusTab == null) {
      return;
    }

    const focusedTab = document.activeElement?.closest('[role="tab"]');
    if (!(focusedTab instanceof HTMLElement) || !focusedTab.id.startsWith(tabIdPrefix)) {
      return;
    }

    const focusedTabId = focusedTab.id.slice(tabIdPrefix.length);
    if (!removedIds.some((id) => String(id) === focusedTabId)) {
      return;
    }

    requestAnimationFrame(() => {
      onFocusTab(activeId);
    });
  }, [activeId, onFocusTab, removedIds, tabIdPrefix]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  /**
   * Tab currently being dragged for overlay preview.
   */
  const activeDragTab = useMemo(() => {
    if (activeDragId == null) {
      return null;
    }
    return tabs.find((tab) => tab.id === activeDragId) ?? null;
  }, [activeDragId, tabs]);

  /**
   * Records the tab being dragged for overlay preview.
   */
  const handleDragStart = (event: DragStartEvent): void => {
    const tabId = parseTabSortableId(resolvedSortablePrefix, String(event.active.id));
    if (tabId == null) {
      setActiveDragId(null);
      return;
    }

    const match = tabs.find((tab) => String(tab.id) === tabId);
    setActiveDragId(match?.id ?? null);
  };

  /**
   * Persists a new tab order when a tab is dropped.
   */
  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over || !sortableEnabled) {
      return;
    }

    const activeTabIdFromDrag = parseTabSortableId(resolvedSortablePrefix, String(active.id));
    const overTabId = parseTabSortableId(resolvedSortablePrefix, String(over.id));
    if (activeTabIdFromDrag == null || overTabId == null || activeTabIdFromDrag === overTabId) {
      return;
    }

    const tabIds = tabs.map((tab) => tab.id);
    const oldIndex = tabIds.findIndex((id) => String(id) === activeTabIdFromDrag);
    const newIndex = tabIds.findIndex((id) => String(id) === overTabId);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    onReorder(arrayMove(tabIds, oldIndex, newIndex));
  };

  /**
   * Moves focus and selection across open tabs with arrow, Home, and End keys.
   */
  const handleTabListKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'ArrowDown' && onArrowDownIntoPanel != null) {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement) {
        const tabElement = activeElement.closest('[role="tab"]');
        if (tabElement instanceof HTMLElement && tabElement.id.startsWith(tabIdPrefix)) {
          const tabId = tabElement.id.slice(tabIdPrefix.length);
          const match = tabs.find((tab) => String(tab.id) === tabId);
          if (match != null && onArrowDownIntoPanel(match.id)) {
            event.preventDefault();
            return;
          }
        }
      }
    }

    const currentIndex = resolveFocusedTabIndex(tabs, activeId, tabIdPrefix);
    if (currentIndex < 0) {
      return;
    }

    const nextIndex = resolveTabListKeyAction(event.key, currentIndex, tabs.length);
    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    onSelect(nextTab.id);

    if (onFocusTab != null) {
      requestAnimationFrame(() => {
        onFocusTab(nextTab.id);
      });
    }
  };

  const tabRowClassName = wrap ? 'w-full min-w-0 py-1' : 'flex w-max flex-nowrap items-end py-1';
  const tabListClassName = wrap
    ? 'flex min-w-0 w-full flex-wrap items-end gap-y-2'
    : 'flex items-end';
  const sortStrategy = wrap ? rectSortingStrategy : horizontalListSortingStrategy;

  const newTabButton = (
    <TabNewButton
      wrapped={wrap}
      ariaLabel={newTab.ariaLabel}
      title={newTab.title}
      onClick={newTab.onClick}
    />
  );

  /**
   * Renders one tab shell, optionally inside a close-animation wrapper.
   */
  const renderTabShell = (
    item: TabBarItem<TId>,
    options: {
      tabIndex: number;
      sortableDisabled: boolean;
      exiting?: boolean;
      onContextMenu?: (id: TId, event: MouseEvent<HTMLDivElement>) => void;
    }
  ): JSX.Element => (
    <TabBarShell
      item={item}
      tabIndex={options.tabIndex}
      sortableId={tabSortableId(resolvedSortablePrefix, item.id)}
      sortableDisabled={options.sortableDisabled}
      exiting={options.exiting}
      tabIdPrefix={tabIdPrefix}
      panelIdPrefix={panelIdPrefix}
      maxTabWidthClass={maxTabWidthClass}
      sortableCursor={sortableCursor}
      onSelect={onSelect}
      onClose={onClose}
      onContextMenu={options.onContextMenu}
    />
  );

  const tabRow = (
    <div className={tabRowClassName}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveDragId(null)}
      >
        <div
          role="tablist"
          aria-label={ariaLabel}
          className={tabListClassName}
          onKeyDown={handleTabListKeyDown}
        >
          <SortableContext items={sortableIds} strategy={sortStrategy}>
            {tabs.flatMap((tab) => {
              const nodes: JSX.Element[] = getExitingBefore(tab.id).map((exitingTab) => (
                <ClosingTabShell
                  key={exitingTab.exitKey}
                  onComplete={() => completeExit(exitingTab.exitKey)}
                >
                  {renderTabShell(exitingTab.item, {
                    tabIndex: -1,
                    sortableDisabled: true,
                    exiting: true
                  })}
                </ClosingTabShell>
              ));

              nodes.push(
                <TabBarShell
                  key={`live-${String(tab.id)}`}
                  item={tab}
                  tabIndex={0}
                  sortableId={tabSortableId(resolvedSortablePrefix, tab.id)}
                  sortableDisabled={!sortableEnabled}
                  tabIdPrefix={tabIdPrefix}
                  panelIdPrefix={panelIdPrefix}
                  maxTabWidthClass={maxTabWidthClass}
                  sortableCursor={sortableCursor}
                  onSelect={onSelect}
                  onClose={onClose}
                  onContextMenu={
                    buildContextMenuGroups == null
                      ? undefined
                      : (id, event) => {
                          setContextMenu({
                            targetId: id,
                            x: event.clientX,
                            y: event.clientY
                          });
                        }
                  }
                />
              );

              return nodes;
            })}
            {getExitingBefore(null).map((exitingTab) => (
              <ClosingTabShell
                key={exitingTab.exitKey}
                onComplete={() => completeExit(exitingTab.exitKey)}
              >
                {renderTabShell(exitingTab.item, {
                  tabIndex: -1,
                  sortableDisabled: true,
                  exiting: true
                })}
              </ClosingTabShell>
            ))}
          </SortableContext>
          {wrap ? newTabButton : null}
        </div>

        <DragOverlay>
          {activeDragTab ? (
            <div className="rounded-t-lg border border-separator bg-surface px-3 py-2 text-[14px] font-medium shadow-md">
              {activeDragTab.dragLabel}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      {wrap ? null : newTabButton}
    </div>
  );

  const defaultScrollContainer = (row: ReactNode): ReactNode => (
    <div className="min-w-0 flex-1 overflow-x-auto">{row}</div>
  );

  const scrollContainer = renderScrollContainer ?? defaultScrollContainer;

  const containerClassName = cn(
    'app-no-drag flex shrink-0 items-end border-b border-separator bg-sidebar px-2',
    className
  );

  return (
    <div className={containerClassName}>
      {wrap ? <div className="min-w-0 flex-1">{tabRow}</div> : scrollContainer(tabRow)}
      {contextMenu != null && buildContextMenuGroups != null && (
        <TabContextMenu
          groups={contextMenuGroups}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

export type { TabBarItem, TabBarNewTab, TabBarSortableCursor } from './types.js';
export { TabNewButton } from './TabNewButton.js';
export { TabContextMenu } from './TabContextMenu.js';
export { ClosingTabShell } from './ClosingTabShell.js';
export { TabBarShell } from './TabBarShell.js';
export { useSortableTabItem } from './useSortableTabItem.js';
export {
  useExitingTabItems,
  detectRemovedTabItems,
  resolveInsertBeforeId,
  type ExitingTabItem
} from './useExitingTabItems.js';
export {
  buildTabCloseMenuGroups,
  tabIdsToCloseOthers,
  tabIdsToCloseToTheRight
} from './tabCloseMenuHelpers.js';
