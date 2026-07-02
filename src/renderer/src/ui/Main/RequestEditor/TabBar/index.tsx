import { FaIcon, resolveTabListKeyAction } from '@harborclient/sdk/components';
import type { JSX, KeyboardEvent } from 'react';
import { useMemo } from 'react';
import { isPageTab, type Tab } from '#/renderer/src/store/drafts';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectCollections, selectEnvironments } from '#/renderer/src/store/selectors';
import { getRegisteredMainViews } from '#/renderer/src/plugins/registry';

import { faPlus } from '#/renderer/src/fontawesome';
import { pageTabMeta } from './pageTabMeta';
import { TabItem } from './TabItem';

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
}

/**
 * Horizontal tab bar for switching between open request editors and page tabs.
 */
export function TabBar({ tabs, activeTabId, onSelect, onClose, onNew }: Props): JSX.Element {
  const collections = useAppSelector(selectCollections);
  const allEnvironments = useAppSelector(selectEnvironments);

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

      if (page.type === 'collection') {
        collectionName = collections.find((collection) => collection.id === page.id)?.name;
      } else if (page.type === 'environment') {
        environmentName = allEnvironments.find((environment) => environment.id === page.id)?.name;
      } else if (page.type === 'plugin-view') {
        pluginTitle = getRegisteredMainViews().find(
          (view) => view.pluginId === page.pluginId && view.id === page.viewId
        )?.title;
      }

      displays.set(tab.tabId, pageTabMeta(page, { collectionName, environmentName, pluginTitle }));
    }
    return displays;
  }, [tabs, collections, allEnvironments]);

  /**
   * Moves focus and selection across open tabs with arrow, Home, and End keys
   * following the WAI-ARIA tabs pattern.
   *
   * @param event - Keyboard event from the tab list container.
   */
  const handleTabListKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const currentIndex = tabs.findIndex((tab) => tab.tabId === activeTabId);
    const nextIndex = resolveTabListKeyAction(event.key, currentIndex, tabs.length);
    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    onSelect(nextTab.tabId);

    requestAnimationFrame(() => {
      document.getElementById(`request-tab-${nextTab.tabId}`)?.focus();
    });
  };

  return (
    <div className="flex shrink-0 min-h-15 items-end gap-0 overflow-x-auto border-b border-separator bg-sidebar px-2 py-1 app-no-drag">
      <div
        role="tablist"
        aria-label="Open tabs"
        className="flex items-end"
        onKeyDown={handleTabListKeyDown}
      >
        {tabs.map((tab) => {
          const pageDisplay = pageTabDisplays.get(tab.tabId);
          return (
            <TabItem
              key={tab.tabId}
              tab={tab}
              active={tab.tabId === activeTabId}
              tabIndex={tab.tabId === activeTabId ? 0 : -1}
              pageTitle={pageDisplay?.title}
              pageIcon={pageDisplay?.icon}
              onSelect={onSelect}
              onClose={onClose}
            />
          );
        })}
      </div>
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
