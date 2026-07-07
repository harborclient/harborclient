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
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates
} from '@dnd-kit/sortable';
import { FaIcon, resolveTabListKeyAction } from '@harborclient/sdk/components';
import type { JSX, KeyboardEvent } from 'react';
import { useMemo, useState } from 'react';
import { isPageTab, isRequestTab, type Tab } from '#/renderer/src/store/drafts';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectCollections, selectEnvironments } from '#/renderer/src/store/selectors';
import { getRegisteredMainViews } from '#/renderer/src/plugins/registry';
import { useTeamHubs } from '#/renderer/src/hooks/useTeamHubs';
import { resolveTeamHubAdminTabLabel } from '#/renderer/src/ui/TeamHub/teamHubDisplayName';

import { faPlus } from '#/renderer/src/fontawesome';
import { pageTabMeta } from './pageTabMeta';
import { focusRequestTabControl } from './focusFirstRequestTab';
import {
  focusFirstFocusableInRequestTabPanel,
  resolveRequestTabIdFromFocusTarget
} from './focusRequestTabPanel';
import { TabItem } from './TabItem';

/** Prefix for request editor tab label element ids. */
const REQUEST_TAB_ID_PREFIX = 'request-tab-';

/** Prefix for request editor sortable drag ids. */
const REQUEST_TAB_SORT_PREFIX = 'request-tab-sort:';

/**
 * Builds a stable dnd-kit sortable id for a request editor tab.
 *
 * @param tabId - Open tab id.
 */
function requestTabSortableId(tabId: string): string {
  return `${REQUEST_TAB_SORT_PREFIX}${tabId}`;
}

/**
 * Parses a request editor sortable drag id back to its tab id.
 *
 * @param dragId - Sortable id from dnd-kit.
 */
function parseRequestTabSortableId(dragId: string): string | null {
  if (!dragId.startsWith(REQUEST_TAB_SORT_PREFIX)) {
    return null;
  }
  return dragId.slice(REQUEST_TAB_SORT_PREFIX.length);
}

/**
 * Resolves the tab list index for arrow-key navigation from keyboard focus.
 *
 * Uses the focused tab label when focus is inside a tab row; falls back to the
 * currently selected tab when focus is elsewhere in the tab list.
 *
 * @param tabs - Open tabs in display order.
 * @param activeTabId - Currently selected tab id.
 * @returns Index into `tabs`, or `-1` when the list is empty.
 */
function resolveFocusedTabIndex(tabs: Tab[], activeTabId: string): number {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement) {
    const tabElement = activeElement.closest('[role="tab"]');
    if (tabElement instanceof HTMLElement && tabElement.id.startsWith(REQUEST_TAB_ID_PREFIX)) {
      const tabId = tabElement.id.slice(REQUEST_TAB_ID_PREFIX.length);
      const focusedIndex = tabs.findIndex((tab) => tab.tabId === tabId);
      if (focusedIndex >= 0) {
        return focusedIndex;
      }
    }
  }

  return tabs.findIndex((tab) => tab.tabId === activeTabId);
}

/**
 * Resolves overlay preview text for a dragged request editor tab.
 *
 * @param tab - Tab being dragged.
 * @param pageTitle - Resolved page tab title, when applicable.
 */
function requestTabDragLabel(tab: Tab, pageTitle?: string): string {
  if (isPageTab(tab)) {
    return pageTitle ?? 'Page';
  }
  if (isRequestTab(tab)) {
    return `${tab.draft.method} ${tab.draft.name}`;
  }
  return 'Tab';
}

interface Props {
  /**
   * All open tabs.
   */
  tabs: Tab[];

  /**
   * ID of the currently active tab.
   */
  activeTabId: string;

  /**
   * Called when the user selects a tab.
   *
   * @param tabId - Tab to activate.
   */
  onSelect: (tabId: string) => void;

  /**
   * Called when the user closes a tab.
   *
   * @param tabId - Tab to close.
   */
  onClose: (tabId: string) => void;

  /**
   * Opens a new blank request tab.
   */
  onNew: () => void;

  /**
   * Persists a new tab order after drag-and-drop reordering.
   *
   * @param orderedTabIds - Tab ids in display order.
   */
  onReorder: (orderedTabIds: string[]) => void;
}

/**
 * Horizontal tab bar for switching between open request editors and page tabs.
 */
export function TabBar({
  tabs,
  activeTabId,
  onSelect,
  onClose,
  onNew,
  onReorder
}: Props): JSX.Element {
  const collections = useAppSelector(selectCollections);
  const allEnvironments = useAppSelector(selectEnvironments);
  const { teamHubs } = useTeamHubs();
  const [activeDragTabId, setActiveDragTabId] = useState<string | null>(null);
  const sortableEnabled = tabs.length >= 2;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  /**
   * Stable sortable ids for open request editor tabs.
   */
  const sortableIds = useMemo(() => tabs.map((tab) => requestTabSortableId(tab.tabId)), [tabs]);

  /**
   * Resolves display metadata for each page tab using current entity names.
   */
  const pageTabDisplays = useMemo(() => {
    const displays = new Map<string, ReturnType<typeof pageTabMeta>>();
    for (const tab of tabs) {
      if (!isPageTab(tab)) {
        continue;
      }

      const page = tab.page;
      let collectionName: string | undefined;
      let environmentName: string | undefined;
      let pluginTitle: string | undefined;
      let teamHubName: string | undefined;

      if (page.type === 'collection') {
        collectionName = collections.find((collection) => collection.id === page.id)?.name;
      } else if (page.type === 'environment') {
        environmentName = allEnvironments.find((environment) => environment.id === page.id)?.name;
      } else if (page.type === 'plugin-view') {
        pluginTitle = getRegisteredMainViews().find(
          (view) => view.pluginId === page.pluginId && view.id === page.viewId
        )?.title;
      } else if (page.type === 'team-hub-admin') {
        teamHubName = resolveTeamHubAdminTabLabel(page, teamHubs);
      }

      displays.set(
        tab.tabId,
        pageTabMeta(page, {
          collectionName,
          environmentName,
          pluginTitle,
          teamHubName
        })
      );
    }
    return displays;
  }, [tabs, collections, allEnvironments, teamHubs]);

  /**
   * Tab currently being dragged for overlay preview.
   */
  const activeDragTab = useMemo(() => {
    if (activeDragTabId == null) {
      return null;
    }
    return tabs.find((tab) => tab.tabId === activeDragTabId) ?? null;
  }, [activeDragTabId, tabs]);

  /**
   * Records the tab being dragged for overlay preview.
   *
   * @param event - Drag start event from dnd-kit.
   */
  const handleDragStart = (event: DragStartEvent): void => {
    const tabId = parseRequestTabSortableId(String(event.active.id));
    setActiveDragTabId(tabId);
  };

  /**
   * Persists a new tab order when a tab is dropped.
   *
   * @param event - Drag end event from dnd-kit.
   */
  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;
    setActiveDragTabId(null);
    if (!over || !sortableEnabled) {
      return;
    }

    const activeTabIdFromDrag = parseRequestTabSortableId(String(active.id));
    const overTabId = parseRequestTabSortableId(String(over.id));
    if (activeTabIdFromDrag == null || overTabId == null || activeTabIdFromDrag === overTabId) {
      return;
    }

    const tabIds = tabs.map((tab) => tab.tabId);
    const oldIndex = tabIds.indexOf(activeTabIdFromDrag);
    const newIndex = tabIds.indexOf(overTabId);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    onReorder(arrayMove(tabIds, oldIndex, newIndex));
  };

  /**
   * Moves focus and selection across open tabs with arrow, Home, and End keys,
   * and moves Down from a focused request tab into its editor panel.
   *
   * @param event - Keyboard event from the tab list container.
   */
  const handleTabListKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'ArrowDown') {
      const focusedTabId = resolveRequestTabIdFromFocusTarget(document.activeElement);
      if (focusedTabId != null) {
        const focusedTab = tabs.find((tab) => tab.tabId === focusedTabId);
        if (focusedTab != null && isRequestTab(focusedTab)) {
          event.preventDefault();

          /**
           * Waits for React to mount the linked tab panel before focusing inside it.
           */
          const focusPanel = (): void => {
            focusFirstFocusableInRequestTabPanel(focusedTabId);
          };

          if (focusedTabId !== activeTabId) {
            onSelect(focusedTabId);
            requestAnimationFrame(() => {
              requestAnimationFrame(focusPanel);
            });
          } else {
            requestAnimationFrame(focusPanel);
          }

          return;
        }
      }
    }

    const currentIndex = resolveFocusedTabIndex(tabs, activeTabId);
    const nextIndex = resolveTabListKeyAction(event.key, currentIndex, tabs.length);
    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    onSelect(nextTab.tabId);

    requestAnimationFrame(() => {
      focusRequestTabControl(nextTab.tabId);
    });
  };

  return (
    <div className="flex shrink-0 min-h-16 items-end gap-0 overflow-x-auto border-b border-separator bg-sidebar px-2 py-1 app-no-drag">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveDragTabId(null)}
      >
        <div
          role="tablist"
          aria-label="Open tabs"
          className="flex items-end"
          onKeyDown={handleTabListKeyDown}
        >
          <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
            {tabs.map((tab) => {
              const pageDisplay = pageTabDisplays.get(tab.tabId);
              return (
                <TabItem
                  key={tab.tabId}
                  tab={tab}
                  active={tab.tabId === activeTabId}
                  tabIndex={0}
                  sortableId={requestTabSortableId(tab.tabId)}
                  sortableDisabled={!sortableEnabled}
                  pageTitle={pageDisplay?.title}
                  pageIcon={pageDisplay?.icon}
                  onSelect={onSelect}
                  onClose={onClose}
                />
              );
            })}
          </SortableContext>
        </div>

        <DragOverlay>
          {activeDragTab ? (
            <div className="rounded-t-lg border border-separator bg-surface px-3 py-2 text-[14px] font-medium shadow-md">
              {requestTabDragLabel(activeDragTab, pageTabDisplays.get(activeDragTab.tabId)?.title)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      <div className="flex shrink-0 items-end ms-2 px-1 -mb-1">
        <button
          type="button"
          className="hc-tab-new-button mb-2.5 inline-flex shrink-0 cursor-pointer items-center justify-center border-none bg-transparent text-[14px] text-muted hover:bg-selection hover:text-text focus-visible:bg-selection focus-visible:text-text app-no-drag"
          title="New tab"
          aria-label="New tab"
          onClick={onNew}
        >
          <FaIcon icon={faPlus} className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
