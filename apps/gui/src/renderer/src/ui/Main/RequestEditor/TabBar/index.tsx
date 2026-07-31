import { Scrollbars } from '#/renderer/src/ui/Shared/Scrollbars';
import {
  TabBar as SdkTabBar,
  buildTabCloseMenuGroups,
  type TabBarItem
} from '@harborclient/sdk/components';
import { useMemo, type JSX, type ReactNode } from 'react';
import { isMarkdownTab, isPageTab, isRequestTab, type Tab } from '#/renderer/src/store/tabs';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectWrapTabs } from '#/renderer/src/store/slices/settingsSlice';
import {
  selectCollections,
  selectEnvironments,
  selectFoldersByCollection,
  selectRequestsByCollection
} from '#/renderer/src/store/selectors';
import { getRegisteredMainViews } from '#/renderer/src/plugins/registry';
import { useTeamHubs } from '#/renderer/src/hooks/useTeamHubs';
import { resolveTeamHubAdminTabLabel } from '#/renderer/src/ui/Tabs/TeamHub/teamHubDisplayName';
import {
  resolveRunnerTargetNames,
  runnerTargetLabel
} from '#/renderer/src/ui/Tabs/CollectionRunner/resolveRunnerTargetName';
import { selectThemeDesignerIsDirty } from '#/renderer/src/store/slices/themeDesignerSlice';
import { selectWorkspaces } from '#/renderer/src/store/slices/workspaceSlice';
import { selectWorkflows } from '#/renderer/src/store/slices/workflowsSlice';

import { pageTabMeta } from './pageTabMeta';
import { focusRequestTabControl } from './focusFirstRequestTab';
import { focusFirstFocusableInRequestTabPanel } from './focusRequestTabPanel';
import { buildRequestTabBarItems } from './buildRequestTabBarItems';

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
   * Closes multiple tabs, prompting once when any have unsaved changes.
   *
   * @param tabIds - Tabs to close.
   */
  onCloseMany: (tabIds: string[]) => void;

  /**
   * Closes every tab that has no unsaved changes.
   */
  onCloseSaved: () => void;

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
  onCloseMany,
  onCloseSaved,
  onNew,
  onReorder
}: Props): JSX.Element {
  const collections = useAppSelector(selectCollections);
  const allEnvironments = useAppSelector(selectEnvironments);
  const workspaces = useAppSelector(selectWorkspaces);
  const workflows = useAppSelector(selectWorkflows);
  const foldersByCollection = useAppSelector(selectFoldersByCollection);
  const requestsByCollection = useAppSelector(selectRequestsByCollection);
  const themeDesignerDirty = useAppSelector(selectThemeDesignerIsDirty);
  const { teamHubs } = useTeamHubs();
  const wrapTabs = useAppSelector(selectWrapTabs);

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
      let workspaceName: string | undefined;
      let folderName: string | undefined;
      let pluginTitle: string | undefined;
      let pluginIcon: string | undefined;
      let teamHubName: string | undefined;
      let runnerTargetName: string | undefined;
      let workflowName: string | undefined;

      if (page.type === 'collection') {
        collectionName = collections.find((collection) => collection.id === page.id)?.name;
      } else if (page.type === 'folder') {
        folderName = (foldersByCollection[page.collectionId] ?? []).find(
          (folder) => folder.id === page.id
        )?.name;
      } else if (page.type === 'environment') {
        environmentName = allEnvironments.find((environment) => environment.id === page.id)?.name;
      } else if (page.type === 'workspace') {
        workspaceName = workspaces.find((workspace) => workspace.id === page.id)?.name;
      } else if (page.type === 'collection-runner') {
        if (page.requestIds != null && page.requestIds.length > 0) {
          runnerTargetName = `${page.requestIds.length} request${page.requestIds.length === 1 ? '' : 's'}`;
        } else {
          const names = resolveRunnerTargetNames(
            {
              collectionId: page.collectionId,
              folderId: page.folderId,
              requestId: page.requestId
            },
            collections,
            foldersByCollection[page.collectionId] ?? [],
            requestsByCollection[page.collectionId] ?? []
          );
          runnerTargetName = runnerTargetLabel(names);
        }
      } else if (page.type === 'workflow-run-results') {
        workflowName = workflows.find((workflow) => workflow.uuid === page.workflowUuid)?.name;
      } else if (page.type === 'hosted-main-view') {
        const view = getRegisteredMainViews().find(
          (entry) => entry.pluginId === page.pluginId && entry.contributionId === page.viewId
        );
        pluginTitle = view?.title;
        pluginIcon = view?.icon;
      } else if (page.type === 'team-hub-admin') {
        teamHubName = resolveTeamHubAdminTabLabel(page, teamHubs);
      }

      displays.set(
        tab.tabId,
        pageTabMeta(page, {
          collectionName,
          environmentName,
          workspaceName,
          folderName,
          pluginTitle,
          pluginIcon,
          teamHubName,
          runnerTargetName,
          workflowName
        })
      );
    }

    return displays;
  }, [
    tabs,
    collections,
    allEnvironments,
    workspaces,
    workflows,
    foldersByCollection,
    requestsByCollection,
    teamHubs
  ]);

  /**
   * Maps open request editor tabs into SDK tab bar rows.
   */
  const tabBarItems = useMemo(
    (): TabBarItem<string>[] =>
      buildRequestTabBarItems({
        tabs,
        activeTabId,
        pageTabDisplays,
        themeDesignerDirty
      }),
    [activeTabId, pageTabDisplays, themeDesignerDirty, tabs]
  );

  /**
   * Wraps the tab row in the app horizontal scrollbar when tabs do not wrap.
   */
  const renderScrollContainer = (row: ReactNode): ReactNode => (
    <Scrollbars axis="horizontal" className="hc-tab-bar-scroll min-w-0 flex-1">
      {row}
    </Scrollbars>
  );

  return (
    <SdkTabBar
      tabs={tabBarItems}
      activeId={activeTabId}
      wrap={wrapTabs}
      ariaLabel="Open tabs"
      tabIdPrefix="request-tab-"
      panelIdPrefix="request-tabpanel-"
      sortablePrefix="request-tab-sort:"
      className="hc-tab-bar min-h-16"
      maxTabWidthClass="max-w-[220px]"
      newTab={{
        ariaLabel: 'New tab',
        title: 'New tab',
        onClick: onNew
      }}
      onSelect={onSelect}
      onClose={onClose}
      onReorder={onReorder}
      buildContextMenuGroups={(targetId, orderedIds) =>
        buildTabCloseMenuGroups(orderedIds, targetId, {
          onClose,
          onCloseMany,
          onCloseSaved
        })
      }
      onFocusTab={focusRequestTabControl}
      onArrowDownIntoPanel={(tabId) => {
        const tab = tabs.find((entry) => entry.tabId === tabId);
        if (tab == null || (!isRequestTab(tab) && !isMarkdownTab(tab))) {
          return false;
        }

        if (tabId !== activeTabId) {
          onSelect(tabId);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              focusFirstFocusableInRequestTabPanel(tabId);
            });
          });
        } else {
          requestAnimationFrame(() => {
            focusFirstFocusableInRequestTabPanel(tabId);
          });
        }

        return true;
      }}
      renderScrollContainer={wrapTabs ? undefined : renderScrollContainer}
    />
  );
}
