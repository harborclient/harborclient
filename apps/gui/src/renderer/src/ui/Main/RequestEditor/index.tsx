import { Scrollbars } from '#/renderer/src/ui/Shared/Scrollbars';
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import type { RequestTabContext, ResponseTabContext } from '@harborclient/core/plugin/types';
import type { Variable } from '@harborclient/core/types';
import { DEFAULT_REQUEST_EDITOR_SPLIT_HEIGHT } from '@harborclient/core/types';
import {
  isBrowserTab,
  isMarkdownTab,
  isPageTab,
  isRequestTab,
  isTabDirty,
  type Tab
} from '#/renderer/src/store/tabs';
import {
  toPluginHttpResponse,
  toPluginRequestDraft,
  toPluginRequestTabContext,
  pluginRequestKey
} from '#/renderer/src/plugins/pluginContextAdapters';
import { clearActiveResponse } from '#/renderer/src/plugins/hostRequestCommands';
import { buildRuntimeVars } from '#/renderer/src/scripting/scriptOrchestration';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { store } from '#/renderer/src/store/redux';
import { closeWebpageTab } from '#/renderer/src/store/browser/webpageSession';
import { discardThemeDesignerSession } from '#/renderer/src/store/thunks/theme';
import { selectThemeDesignerIsDirty } from '#/renderer/src/store/slices/themeDesignerSlice';
import { selectWorkspaces } from '#/renderer/src/store/slices/workspaceSlice';
import {
  selectActiveBrowserTab,
  selectActiveEnvironmentId,
  selectActiveMarkdownTab,
  selectActivePage,
  selectActiveTabId,
  selectCollections,
  selectDraft,
  selectEnvironments,
  selectExecutionEvents,
  selectFoldersByCollection,
  selectRequestsByCollection,
  selectResponse,
  selectScriptError,
  selectScriptErrors,
  selectScriptLogs,
  selectSending,
  selectTabs,
  selectTestResults
} from '#/renderer/src/store/selectors';
import {
  cancelCollectionRunner,
  closeCollectionRunner
} from '#/renderer/src/store/slices/modalsSlice';
import {
  selectCollectionSettingsDirty,
  selectEnvironmentSettingsDirty,
  selectFolderSettingsDirty,
  selectWorkspaceSettingsDirty,
  selectRequestEditorSplitHeight,
  selectShowRequestEditor,
  selectShowResponseEditor,
  setRequestEditorSplitHeight
} from '#/renderer/src/store/slices/navigationSlice';
import {
  setActiveDraft,
  newTab,
  setActiveTab,
  closeTab,
  closeAllRequestAndMarkdownTabs,
  reorderTabs,
  updateBrowserNavigation,
  openInheritedBrowserTab
} from '#/renderer/src/store/slices/tabsSlice';
import { addConsoleEntry } from '#/renderer/src/store/slices/consoleSlice';
import { useCopyToChat } from '#/renderer/src/hooks/useCopyToChat';
import { buildWebpageReferenceToken } from '@harborclient/core/ai/scriptReferences';
import {
  sendRequest,
  cancelRequest,
  closeMarkdownTab,
  closeRequestTab,
  focusSidebarItem,
  saveFromMenu
} from '#/renderer/src/store/thunks';
import { openSaveRequestModal } from '#/renderer/src/store/slices/modalsSlice';
import { patchGeneralSettings } from '#/renderer/src/store/thunks/settings';
import { maybePersistLiveServerLastOpenedFromNavigation } from '#/renderer/src/store/thunks/liveServers';
import { maybePersistWebsiteFaviconFromNavigation } from '#/renderer/src/store/thunks/websites';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/Modals/dialogHelpers';
import { mergeRequestVariables } from '#/renderer/src/hooks/useMergedRequestVariables';
import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/expansion/useSidebarExpansion';
import { useTeamHubs } from '#/renderer/src/hooks/useTeamHubs';
import { Button, Checkbox, Modal, ModalFooter } from '@harborclient/sdk/components';
import { ResizeHandle, useResizable } from '@harborclient/sdk/components';
import { Editor } from './Editor';
import { NoOpenRequests } from './NoOpenRequests';
import { BrowserTabContent } from './BrowserTab';
import { consoleEntryFromBrowserPayload } from './BrowserTab/browserConsoleEntry';
import { hasBrowserGuest, syncDestroyedBrowserGuests } from './BrowserTab/browserGuestRegistry';
import { isActivePageTabDirty, pageTabCloseName } from './pageTabCloseHelpers';
import { PageTabContent } from './PageTabContent';
import { ResponseEditor } from '../ResponseEditor';
import { RESPONSE_EDITOR_SECTION_ID } from '../ResponseEditor/focusResponseEditor';
import { REQUEST_EDITOR_SECTION_ID } from '#/renderer/src/ui/Shared/SkipNavigation/skipNavigationTargets';
import { TabBar } from './TabBar';
import { MarkdownEditorTab } from './MarkdownEditorTab';
import { useEditVariableNavigation } from './useEditVariableNavigation';

interface CloseTabPrompt {
  tabId: string;
  name: string;
}

interface CloseManyPrompt {
  /**
   * Tab ids the user asked to close in one bulk action.
   */
  tabIds: string[];

  /**
   * Number of tabs in the bulk action that have unsaved changes.
   */
  dirtyCount: number;
}

/**
 * Returns whether closing a tab should prompt for unsaved changes.
 *
 * @param tab - Open tab being evaluated.
 * @param activeTabId - Currently selected tab id.
 * @param collectionSettingsDirty - Whether collection settings have unsaved edits.
 * @param environmentSettingsDirty - Whether environment settings have unsaved edits.
 * @param folderSettingsDirty - Whether folder settings have unsaved edits.
 * @param workspaceSettingsDirty - Whether workspace settings have unsaved edits.
 * @param warnWhenClosingUnsavedRequests - Whether request-tab close prompts are enabled.
 * @param themeDesignerDirty - Whether the Theme Designer has unsaved edits.
 */
function isDirtyForClose(
  tab: Tab,
  activeTabId: string,
  collectionSettingsDirty: boolean,
  environmentSettingsDirty: boolean,
  folderSettingsDirty: boolean,
  workspaceSettingsDirty: boolean,
  warnWhenClosingUnsavedRequests: boolean,
  themeDesignerDirty: boolean
): boolean {
  if (isMarkdownTab(tab)) {
    return warnWhenClosingUnsavedRequests && isTabDirty(tab);
  }

  if (isBrowserTab(tab)) {
    return warnWhenClosingUnsavedRequests && isTabDirty(tab);
  }

  if (isRequestTab(tab)) {
    return warnWhenClosingUnsavedRequests && isTabDirty(tab);
  }

  if (isPageTab(tab) && tab.page.type === 'themes') {
    return themeDesignerDirty;
  }

  if (isPageTab(tab) && (tab.page.type === 'collection' || tab.page.type === 'folder')) {
    return isTabDirty(tab);
  }

  if (isPageTab(tab) && tab.tabId === activeTabId) {
    return isActivePageTabDirty(
      tab.page,
      collectionSettingsDirty,
      environmentSettingsDirty,
      folderSettingsDirty,
      workspaceSettingsDirty
    );
  }

  return false;
}

/**
 * Merges global, collection, and environment variables; higher scopes win on duplicate keys.
 */
function mergeVariables(
  globalVars: Variable[],
  collectionVars: Variable[],
  folderVars: Variable[],
  envVars: Variable[]
): Variable[] {
  return mergeRequestVariables(globalVars, collectionVars, folderVars, envVars);
}

/**
 * Request editor: tab bar, editor, and response viewer.
 */
export function RequestEditor(): JSX.Element {
  const dispatch = useAppDispatch();
  const { revealCollection, revealArchivedCollection, revealFolder } = useSidebarExpansion();
  const { aiAvailable, copyToChat } = useCopyToChat();
  const tabs = useAppSelector(selectTabs);

  const activeTabId = useAppSelector(selectActiveTabId);
  const activePage = useAppSelector(selectActivePage);
  const activeMarkdownTab = useAppSelector(selectActiveMarkdownTab);
  const activeBrowserTab = useAppSelector(selectActiveBrowserTab);
  const activeTab = tabs.find((tab) => tab.tabId === activeTabId);
  const isActivePageTab = activeTab != null && isPageTab(activeTab);

  const isActiveMarkdownTab = activeTab != null && isMarkdownTab(activeTab);
  const isActiveBrowserTab = activeTab != null && isBrowserTab(activeTab);
  const draft = useAppSelector(selectDraft);
  const response = useAppSelector(selectResponse);
  const sending = useAppSelector(selectSending);
  const testResults = useAppSelector(selectTestResults);
  const scriptLogs = useAppSelector(selectScriptLogs);
  const executionEvents = useAppSelector(selectExecutionEvents);
  const scriptError = useAppSelector(selectScriptError);
  const scriptErrors = useAppSelector(selectScriptErrors);
  const environments = useAppSelector(selectEnvironments);
  const collections = useAppSelector(selectCollections);
  const workspaces = useAppSelector(selectWorkspaces);
  const { teamHubs } = useTeamHubs();
  const activeEnvironmentId = useAppSelector(selectActiveEnvironmentId);
  const foldersByCollection = useAppSelector(selectFoldersByCollection);
  const requestsByCollection = useAppSelector(selectRequestsByCollection);
  const collectionSettingsDirty = useAppSelector(selectCollectionSettingsDirty);
  const environmentSettingsDirty = useAppSelector(selectEnvironmentSettingsDirty);
  const folderSettingsDirty = useAppSelector(selectFolderSettingsDirty);
  const workspaceSettingsDirty = useAppSelector(selectWorkspaceSettingsDirty);
  const themeDesignerDirty = useAppSelector(selectThemeDesignerIsDirty);
  const showRequestEditor = useAppSelector(selectShowRequestEditor);
  const showResponseEditor = useAppSelector(selectShowResponseEditor);
  const persistedSplitHeight = useAppSelector(selectRequestEditorSplitHeight);
  const showSplitLayout = showRequestEditor && showResponseEditor;

  /**
   * Keeps the native File → New → Workspace item in sync with open saved request tabs.
   */
  useEffect(() => {
    const hasOpenSavedRequests = tabs.some((tab) => isRequestTab(tab) && tab.draft.id != null);
    void window.api.setWorkspaceAvailable(hasOpenSavedRequests);
  }, [tabs]);

  /**
   * Forwards guest navigation/title updates into browser tab Redux state, and
   * may debounce-persist `lastOpenedPath` for bound live servers with remember
   * enabled. Also syncs late-arriving favicons onto linked live pages.
   */
  useEffect(() => {
    return window.api.onBrowserNavigation((state) => {
      dispatch(updateBrowserNavigation(state));
      dispatch(maybePersistLiveServerLastOpenedFromNavigation(state.tabId, state.url));
      dispatch(maybePersistWebsiteFaviconFromNavigation(state.tabId, state.faviconDataUrl));
    });
  }, [dispatch]);

  /**
   * Appends footer console rows when a live page finishes loading.
   */
  useEffect(() => {
    return window.api.onBrowserConsoleEntry((payload) => {
      const tab = store
        .getState()
        .tabs.tabs.find(
          (candidate) => isBrowserTab(candidate) && candidate.tabId === payload.tabId
        );
      const browserTab = tab != null && isBrowserTab(tab) ? tab : undefined;
      dispatch(addConsoleEntry(consoleEntryFromBrowserPayload(payload, browserTab)));
    });
  }, [dispatch]);

  /**
   * Opens a HarborClient browser tab when a guest requests a popup / new window.
   */
  useEffect(() => {
    return window.api.onBrowserOpenTab((request) => {
      dispatch(openInheritedBrowserTab(request));
    });
  }, [dispatch]);

  /**
   * Inserts `@webpage.<tabId>#x.y` when the guest context menu chooses Copy to chat.
   *
   * No-ops when AI chat is unavailable (main always shows the menu item).
   */
  useEffect(() => {
    return window.api.onBrowserCopyToChat((payload) => {
      if (!aiAvailable) {
        return;
      }
      void copyToChat(buildWebpageReferenceToken(payload.tabId, { x: payload.x, y: payload.y }));
    });
  }, [aiAvailable, copyToChat]);

  /**
   * Destroys main-process guests when their browser tabs are closed.
   */
  useEffect(() => {
    const openIds = new Set(tabs.filter((tab) => isBrowserTab(tab)).map((tab) => tab.tabId));
    syncDestroyedBrowserGuests(openIds);
  }, [tabs]);

  /**
   * Whether a Themes page tab is currently open in the tab bar.
   */
  const themesTabOpen = useMemo(
    () => tabs.some((tab) => isPageTab(tab) && tab.page.type === 'themes'),
    [tabs]
  );

  const themesTabOpenRef = useRef(themesTabOpen);

  /**
   * Discards the Theme Designer session when the Themes tab is closed.
   */
  useEffect(() => {
    if (themesTabOpenRef.current && !themesTabOpen) {
      void dispatch(discardThemeDesignerSession());
    }
    themesTabOpenRef.current = themesTabOpen;
  }, [dispatch, themesTabOpen]);

  const hasOpenTabs = tabs.length > 0;
  const [closeTabPrompt, setCloseTabPrompt] = useState<CloseTabPrompt | null>(null);
  const [closeManyPrompt, setCloseManyPrompt] = useState<CloseManyPrompt | null>(null);
  const [closeTabDontAskAgain, setCloseTabDontAskAgain] = useState(false);
  const [closeManyDontAskAgain, setCloseManyDontAskAgain] = useState(false);
  const splitRef = useRef<HTMLElement>(null);
  const [savingRequest, setSavingRequest] = useState(false);
  const savingRequestRef = useRef(false);

  /**
   * Hides native browser guests while unsaved-close modals are open so the HTML
   * overlay is not covered by WebContentsView, then restores the active guest on dismiss.
   */
  useEffect(() => {
    if (!closeTabPrompt && !closeManyPrompt) {
      return;
    }
    void window.api.browserHideAll();
    return () => {
      const active = tabs.find((tab) => tab.tabId === activeTabId);
      if (active && isBrowserTab(active) && hasBrowserGuest(active.tabId)) {
        void window.api.browserSetVisible(active.tabId, true);
      }
    };
  }, [closeTabPrompt, closeManyPrompt, activeTabId, tabs]);

  /**
   * Reads the split container height so max-size clamping tracks the live layout.
   */
  const getMaxSplitHeight = useCallback((): number => {
    return (splitRef.current?.parentElement?.clientHeight ?? 600) - 160;
  }, []);

  /**
   * Persists a committed request editor split height to Redux for electron-store sync.
   */
  const handleSplitHeightPersist = useCallback(
    (size: number): void => {
      dispatch(setRequestEditorSplitHeight(size));
    },
    [dispatch]
  );

  const {
    size: editorHeight,
    minSize: editorMinSize,
    maxSize: editorMaxSize,
    setSize,
    onResizeStart,
    onKeyboardResize
  } = useResizable({
    axis: 'y',
    direction: 1,
    defaultSize: DEFAULT_REQUEST_EDITOR_SPLIT_HEIGHT,
    minSize: 160,
    getMaxSize: getMaxSplitHeight,
    onPersist: handleSplitHeightPersist
  });

  /**
   * Applies the electron-store split height when panel layout hydration updates Redux.
   */
  useEffect(() => {
    setSize(persistedSplitHeight);
  }, [persistedSplitHeight, setSize]);

  const draftCollectionId = draft.collection_id ?? activeMarkdownTab?.collectionId;
  const activeCollectionId = draftCollectionId ?? null;
  const activeCollection =
    activeCollectionId != null ? collections.find((c) => c.id === activeCollectionId) : undefined;
  /**
   * True when the active request tab has never been persisted into a collection.
   */
  const isCollectionLessRequest =
    activeTab != null && isRequestTab(activeTab) && draft.id == null && draft.collection_id == null;
  const activeEnvironment =
    activeEnvironmentId != null
      ? environments.find((env) => env.id === activeEnvironmentId)
      : undefined;
  const globalVariables = useAppSelector((state) => state.settings.general.globalVariables);
  const warnWhenClosingUnsavedRequests = useAppSelector(
    (state) => state.settings.general.warnWhenClosingUnsavedRequests
  );

  /**
   * Whether the active request tab has unsaved edits or has never been persisted.
   */
  const requestSaveDisabled =
    activeTab == null ||
    !isRequestTab(activeTab) ||
    (activeTab.draft.id != null && !isTabDirty(activeTab));

  /**
   * Persists the active request tab via the same path as File → Save.
   */
  const handleSaveRequest = useCallback((): void => {
    if (savingRequestRef.current || requestSaveDisabled) {
      return;
    }

    savingRequestRef.current = true;
    setSavingRequest(true);
    void dispatch(saveFromMenu())
      .unwrap()
      .catch((err: unknown) => {
        showAlert(dispatch, formatErrorMessage(err, 'Failed to save'));
      })
      .finally(() => {
        savingRequestRef.current = false;
        setSavingRequest(false);
      });
  }, [dispatch, requestSaveDisabled, setSavingRequest]);

  /**
   * Resolves the folder id for the active draft from saved state or draft fields.
   */
  const activeFolderId = useMemo(() => {
    if (activeMarkdownTab) {
      return activeMarkdownTab.folderId;
    }
    if (activeCollectionId == null) return null;
    if (draft.id != null) {
      const saved = (requestsByCollection[activeCollectionId] ?? []).find(
        (request) => request.id === draft.id
      );
      if (saved) return saved.folder_id;
    }
    return draft.folder_id ?? null;
  }, [activeMarkdownTab, draft.folder_id, draft.id, activeCollectionId, requestsByCollection]);

  const onEditVariables = useEditVariableNavigation(activeCollectionId, activeFolderId);

  /**
   * Looks up the active folder record for variable merging and breadcrumb display.
   */
  const activeFolder = useMemo(() => {
    if (activeFolderId == null || activeCollectionId == null) return undefined;
    const folders = foldersByCollection[activeCollectionId] ?? [];
    return folders.find((folder) => folder.id === activeFolderId);
  }, [activeFolderId, activeCollectionId, foldersByCollection]);

  /**
   * Merges global, collection, folder, and environment variables for editor substitution.
   */
  const activeVariables = useMemo(
    () =>
      mergeVariables(
        globalVariables,
        activeCollection?.variables ?? [],
        activeFolder?.variables ?? [],
        activeEnvironment?.variables ?? []
      ),
    [globalVariables, activeCollection, activeFolder, activeEnvironment]
  );

  /**
   * Read-only plugin context for request editor tabs.
   */
  const requestTabContext = useMemo<RequestTabContext>(() => {
    const runtimeVars = buildRuntimeVars(activeVariables);
    return toPluginRequestTabContext(draft, activeCollection, response, runtimeVars);
  }, [draft, activeCollection, response, activeVariables]);

  /**
   * Read-only plugin context for response viewer tabs.
   */
  const responseTabContext = useMemo<ResponseTabContext>(
    () => ({
      draft: toPluginRequestDraft(draft),
      response: toPluginHttpResponse(response),
      requestKey: pluginRequestKey(draft)
    }),
    [draft, response]
  );

  const activeCollectionName = activeCollection?.name;
  const activeFolderName = activeFolder?.name;

  /**
   * Closes one browser tab after the guest accepts unload (or has no leave prompt).
   *
   * @param tabId - Browser tab id to close.
   * @returns True when Redux closed the tab; false when the user stayed on the page.
   */
  const closeBrowserTab = useCallback(
    async (tabId: string): Promise<boolean> => {
      const result = await closeWebpageTab(
        {
          getState: () => store.getState(),
          dispatch
        },
        tabId
      );
      if ('error' in result) {
        return false;
      }
      return result.closed;
    },
    [dispatch]
  );

  /**
   * Closes tabs immediately without prompting, including collection-runner cleanup.
   *
   * When every open tab is included, request/markdown tabs are closed via a single
   * `closeAllRequestAndMarkdownTabs` intent (one workflow event), then remaining
   * browser and page tabs are closed individually.
   *
   * @param tabIds - Tabs to close.
   */
  const closeTabsImmediately = async (tabIds: string[]): Promise<void> => {
    const uniqueTabIds = [...new Set(tabIds)];
    const closingAll =
      uniqueTabIds.length > 0 &&
      tabs.length > 0 &&
      uniqueTabIds.length === tabs.length &&
      tabs.every((tab) => uniqueTabIds.includes(tab.tabId));

    if (closingAll) {
      dispatch(closeAllRequestAndMarkdownTabs());
      for (const tab of tabs) {
        if (isBrowserTab(tab)) {
          await closeBrowserTab(tab.tabId);
          continue;
        }
        if (!isPageTab(tab)) {
          continue;
        }
        if (tab.page.type === 'collection-runner') {
          dispatch(cancelCollectionRunner());
          dispatch(closeCollectionRunner());
        }
        dispatch(closeTab(tab.tabId));
      }
      return;
    }

    for (const tabId of uniqueTabIds) {
      const tab = tabs.find((entry) => entry.tabId === tabId);
      if (!tab) {
        continue;
      }

      if (isPageTab(tab)) {
        if (tab.page.type === 'collection-runner') {
          dispatch(cancelCollectionRunner());
          dispatch(closeCollectionRunner());
        }
        dispatch(closeTab(tabId));
        continue;
      }

      if (isMarkdownTab(tab)) {
        void dispatch(closeMarkdownTab(tabId));
        continue;
      }

      if (isBrowserTab(tab)) {
        await closeBrowserTab(tabId);
        continue;
      }

      void dispatch(closeRequestTab(tabId));
    }
  };

  /**
   * Closes multiple tabs, showing one combined prompt when any are dirty.
   *
   * @param tabIds - Tabs to close.
   */
  const handleCloseMany = (tabIds: string[]): void => {
    const uniqueTabIds = [...new Set(tabIds)];
    const tabsToClose = uniqueTabIds
      .map((tabId) => tabs.find((tab) => tab.tabId === tabId))
      .filter((tab): tab is Tab => tab != null);

    if (tabsToClose.length === 0) {
      return;
    }

    const dirtyCount = tabsToClose.filter((tab) =>
      isDirtyForClose(
        tab,
        activeTabId,
        collectionSettingsDirty,
        environmentSettingsDirty,
        folderSettingsDirty,
        workspaceSettingsDirty,
        warnWhenClosingUnsavedRequests,
        themeDesignerDirty
      )
    ).length;

    if (dirtyCount > 0) {
      setCloseManyPrompt({ tabIds: uniqueTabIds, dirtyCount });
      return;
    }

    void closeTabsImmediately(uniqueTabIds);
  };

  /**
   * Closes every tab that has no unsaved changes.
   */
  const handleCloseSaved = (): void => {
    const savedTabIds = tabs
      .filter(
        (tab) =>
          !isDirtyForClose(
            tab,
            activeTabId,
            collectionSettingsDirty,
            environmentSettingsDirty,
            folderSettingsDirty,
            workspaceSettingsDirty,
            warnWhenClosingUnsavedRequests,
            themeDesignerDirty
          )
      )
      .map((tab) => tab.tabId);

    handleCloseMany(savedTabIds);
  };

  /**
   * Closes a tab, prompting when it has unsaved changes.
   */
  const handleCloseTab = (tabId: string): void => {
    const tab = tabs.find((t) => t.tabId === tabId);
    if (!tab) {
      return;
    }

    if (isMarkdownTab(tab) && warnWhenClosingUnsavedRequests && isTabDirty(tab)) {
      setCloseTabPrompt({ tabId, name: tab.name });
      return;
    }

    if (isBrowserTab(tab) && warnWhenClosingUnsavedRequests && isTabDirty(tab)) {
      setCloseTabPrompt({ tabId, name: tab.title || 'Browser' });
      return;
    }

    if (isRequestTab(tab) && warnWhenClosingUnsavedRequests && isTabDirty(tab)) {
      setCloseTabPrompt({ tabId, name: tab.draft.name });
      return;
    }

    if (isPageTab(tab) && tab.page.type === 'themes' && themeDesignerDirty) {
      setCloseTabPrompt({ tabId, name: 'Themes' });
      return;
    }

    if (
      isPageTab(tab) &&
      (tab.page.type === 'collection' || tab.page.type === 'folder') &&
      isTabDirty(tab)
    ) {
      setCloseTabPrompt({
        tabId,
        name: pageTabCloseName(tab.page, collections, environments, teamHubs, workspaces)
      });
      return;
    }

    if (
      tabId === activeTabId &&
      isPageTab(tab) &&
      isActivePageTabDirty(
        tab.page,
        collectionSettingsDirty,
        environmentSettingsDirty,
        folderSettingsDirty,
        workspaceSettingsDirty
      )
    ) {
      setCloseTabPrompt({
        tabId,
        name: pageTabCloseName(tab.page, collections, environments, teamHubs, workspaces)
      });
      return;
    }

    if (isPageTab(tab)) {
      if (tab.page.type === 'collection-runner') {
        dispatch(cancelCollectionRunner());
        dispatch(closeCollectionRunner());
      }
      dispatch(closeTab(tabId));
      return;
    }

    if (isMarkdownTab(tab)) {
      void dispatch(closeMarkdownTab(tabId));
      return;
    }

    if (isBrowserTab(tab)) {
      void closeBrowserTab(tabId);
      return;
    }

    void dispatch(closeRequestTab(tabId));
  };

  return (
    <>
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelect={(tabId) => dispatch(setActiveTab(tabId))}
        onClose={handleCloseTab}
        onCloseMany={handleCloseMany}
        onCloseSaved={handleCloseSaved}
        onNew={() => dispatch(newTab())}
        onReorder={(orderedTabIds) => dispatch(reorderTabs(orderedTabIds))}
      />
      {hasOpenTabs ? (
        <div
          role="tabpanel"
          id={`request-tabpanel-${activeTabId}`}
          aria-labelledby={`request-tab-${activeTabId}`}
          className="flex min-h-0 flex-1 flex-col"
        >
          {isActivePageTab && activePage ? (
            <div
              key={`page-${activeTabId}`}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <PageTabContent page={activePage} tabId={activeTabId} />
            </div>
          ) : isActiveMarkdownTab && activeMarkdownTab ? (
            <div
              key={`markdown-${activeTabId}`}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <MarkdownEditorTab
                tab={activeMarkdownTab}
                variables={activeVariables}
                onEditVariables={onEditVariables}
              />
            </div>
          ) : isActiveBrowserTab && activeBrowserTab ? (
            <div
              key={`browser-${activeTabId}`}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <BrowserTabContent
                tab={activeBrowserTab}
                variables={activeVariables}
                onEditVariables={onEditVariables}
              />
            </div>
          ) : (
            <>
              {showRequestEditor ? (
                <section
                  id={REQUEST_EDITOR_SECTION_ID}
                  tabIndex={-1}
                  aria-label="Request editor"
                  ref={splitRef}
                  style={showSplitLayout ? { height: editorHeight } : undefined}
                  className={
                    showSplitLayout
                      ? 'flex shrink-0 min-h-0 flex-col'
                      : 'flex min-h-0 flex-1 flex-col'
                  }
                >
                  <Scrollbars
                    axis="vertical"
                    className={showSplitLayout ? 'h-full min-h-0' : 'min-h-0 flex-1'}
                  >
                    <Editor
                      key={`editor-${activeTabId}`}
                      tabId={activeTabId}
                      draft={draft}
                      requestTabContext={requestTabContext}
                      onChange={(next) => dispatch(setActiveDraft(next))}
                      onSend={() => void dispatch(sendRequest())}
                      onSave={handleSaveRequest}
                      onCancel={() => void dispatch(cancelRequest(activeTabId))}
                      sending={sending}
                      savingRequest={savingRequest}
                      saveDisabled={requestSaveDisabled}
                      variables={activeVariables}
                      collectionName={activeCollectionName}
                      folderName={activeFolderName}
                      showCollectionPlaceholder={isCollectionLessRequest}
                      onEditVariables={onEditVariables}
                      onCollectionClick={() => {
                        if (isCollectionLessRequest && activeTabId != null) {
                          dispatch(openSaveRequestModal({ tabId: activeTabId }));
                          return;
                        }
                        if (activeCollectionId == null) return;
                        dispatch(focusSidebarItem({ collectionId: activeCollectionId }));
                        if (activeCollection?.archived) {
                          revealArchivedCollection(activeCollectionId);
                        } else {
                          revealCollection(activeCollectionId);
                        }
                      }}
                      onFolderClick={() => {
                        if (activeCollectionId == null || activeFolderId == null) return;
                        dispatch(
                          focusSidebarItem({
                            collectionId: activeCollectionId,
                            folderId: activeFolderId
                          })
                        );
                        revealFolder(activeCollectionId, activeFolderId);
                      }}
                      testResults={testResults}
                      scriptErrors={scriptErrors}
                    />
                  </Scrollbars>
                </section>
              ) : null}
              {showSplitLayout ? (
                <ResizeHandle
                  orientation="horizontal"
                  value={editorHeight}
                  min={editorMinSize}
                  max={editorMaxSize}
                  onResizeStart={onResizeStart}
                  onKeyboardResize={onKeyboardResize}
                  ariaLabel="Resize request editor"
                />
              ) : null}
              {showResponseEditor ? (
                <section
                  id={RESPONSE_EDITOR_SECTION_ID}
                  tabIndex={-1}
                  aria-label="Response"
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <ResponseEditor
                    key={`response-${activeTabId}`}
                    response={response}
                    responseTabContext={responseTabContext}
                    sending={sending}
                    testResults={testResults}
                    scriptLogs={scriptLogs}
                    executionEvents={executionEvents}
                    scriptError={scriptError}
                    scriptErrors={scriptErrors}
                    requestUrl={draft.url}
                    requestTabId={activeTabId}
                    protocol={draft.protocol === 'sse' ? 'sse' : 'http'}
                    sseSession={
                      activeTab != null && isRequestTab(activeTab)
                        ? (activeTab.sseSession ?? null)
                        : null
                    }
                    onCancel={() => void dispatch(cancelRequest(activeTabId))}
                    onClear={clearActiveResponse}
                  />
                </section>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <NoOpenRequests />
      )}

      {closeTabPrompt && (
        <Modal
          onClose={() => {
            setCloseTabPrompt(null);
            setCloseTabDontAskAgain(false);
          }}
          labelledBy="request-close-tab-title"
          title="Unsaved changes"
          description={
            <>&ldquo;{closeTabPrompt.name}&rdquo; has unsaved changes. Close without saving?</>
          }
        >
          <div className="mb-4 flex items-center gap-2">
            <Checkbox
              id="request-close-tab-dont-ask-again"
              checked={closeTabDontAskAgain}
              onChange={(event) => setCloseTabDontAskAgain(event.target.checked)}
            />
            <label htmlFor="request-close-tab-dont-ask-again" className="text-muted">
              Don&apos;t show this again
            </label>
          </div>
          <ModalFooter>
            <Button
              onClick={() => {
                void (async (): Promise<void> => {
                  if (closeTabDontAskAgain) {
                    await dispatch(patchGeneralSettings({ warnWhenClosingUnsavedRequests: false }));
                  }

                  const tab = tabs.find((entry) => entry.tabId === closeTabPrompt.tabId);
                  const tabIdToClose = closeTabPrompt.tabId;
                  setCloseTabPrompt(null);
                  setCloseTabDontAskAgain(false);
                  if (tab && isPageTab(tab)) {
                    dispatch(closeTab(tabIdToClose));
                  } else if (tab && isMarkdownTab(tab)) {
                    void dispatch(closeMarkdownTab(tabIdToClose));
                  } else if (tab && isBrowserTab(tab)) {
                    await closeBrowserTab(tabIdToClose);
                  } else {
                    void dispatch(closeRequestTab(tabIdToClose));
                  }
                })();
              }}
            >
              Close without saving
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {closeManyPrompt && (
        <Modal
          onClose={() => {
            setCloseManyPrompt(null);
            setCloseManyDontAskAgain(false);
          }}
          labelledBy="request-close-many-tabs-title"
          title="Unsaved changes"
          description={
            closeManyPrompt.dirtyCount === 1 ? (
              <>1 tab has unsaved changes. Close without saving?</>
            ) : (
              <>{closeManyPrompt.dirtyCount} tabs have unsaved changes. Close without saving?</>
            )
          }
        >
          <div className="mb-4 flex items-center gap-2">
            <Checkbox
              id="request-close-many-tabs-dont-ask-again"
              checked={closeManyDontAskAgain}
              onChange={(event) => setCloseManyDontAskAgain(event.target.checked)}
            />
            <label htmlFor="request-close-many-tabs-dont-ask-again" className="text-muted">
              Don&apos;t show this again
            </label>
          </div>
          <ModalFooter>
            <Button
              onClick={() => {
                void (async (): Promise<void> => {
                  if (closeManyDontAskAgain) {
                    await dispatch(patchGeneralSettings({ warnWhenClosingUnsavedRequests: false }));
                  }

                  const tabIds = closeManyPrompt.tabIds;
                  setCloseManyPrompt(null);
                  setCloseManyDontAskAgain(false);
                  await closeTabsImmediately(tabIds);
                })();
              }}
            >
              Close without saving
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
}
