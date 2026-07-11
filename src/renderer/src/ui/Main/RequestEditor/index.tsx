import { Scrollbars } from '#/renderer/src/components/Scrollbars';
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import type { RequestTabContext, ResponseTabContext } from '#/shared/plugin/types';
import type { Variable } from '#/shared/types';
import { DEFAULT_REQUEST_EDITOR_SPLIT_HEIGHT } from '#/shared/types';
import {
  isMarkdownTab,
  isPageTab,
  isRequestTab,
  isTabDirty,
  type Tab
} from '#/renderer/src/store/drafts';
import {
  toPluginHttpResponse,
  toPluginRequestDraft,
  toPluginRequestTabContext,
  pluginRequestKey
} from '#/renderer/src/plugins/pluginContextAdapters';
import { clearActiveResponse } from '#/renderer/src/plugins/hostRequestCommands';
import { buildRuntimeVars } from '#/renderer/src/scripting/scriptOrchestration';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectEditSessionHiddenTabIds } from '#/renderer/src/store/slices/tabGroupSlice';
import {
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
  selectScriptLogs,
  selectSelectedCollectionId,
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
  reorderTabs
} from '#/renderer/src/store/slices/tabsSlice';
import {
  sendRequest,
  cancelRequest,
  closeMarkdownTab,
  closeRequestTab,
  focusSidebarItem
} from '#/renderer/src/store/thunks';
import { patchGeneralSettings } from '#/renderer/src/store/thunks/settings';
import { mergeRequestVariables } from '#/renderer/src/hooks/useMergedRequestVariables';
import { useSidebarExpansion } from '#/renderer/src/ui/sidebars/CollectionSidebar/useSidebarExpansion';
import { useTeamHubs } from '#/renderer/src/hooks/useTeamHubs';
import { Button, Checkbox, Modal, ModalFooter } from '@harborclient/sdk/components';
import { ResizeHandle, useResizable } from '@harborclient/sdk/components';
import { Editor } from './Editor';
import { NoOpenRequests } from './NoOpenRequests';
import { isActivePageTabDirty, pageTabCloseName } from './pageTabCloseHelpers';
import { PageTabContent } from './PageTabContent';
import { ResponseEditor } from '../ResponseEditor';
import { RESPONSE_EDITOR_SECTION_ID } from '../ResponseEditor/focusResponseEditor';
import { TabBar } from './TabBar';
import { MarkdownEditorTab } from './MarkdownEditorTab';

interface Props {
  /**
   * Opens collection settings to edit variables.
   */
  onEditVariables: (key: string) => void;
}

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
 * @param warnWhenClosingUnsavedRequests - Whether request-tab close prompts are enabled.
 */
function isDirtyForClose(
  tab: Tab,
  activeTabId: string,
  collectionSettingsDirty: boolean,
  environmentSettingsDirty: boolean,
  folderSettingsDirty: boolean,
  warnWhenClosingUnsavedRequests: boolean
): boolean {
  if (isMarkdownTab(tab)) {
    return warnWhenClosingUnsavedRequests && isTabDirty(tab);
  }

  if (isRequestTab(tab)) {
    return warnWhenClosingUnsavedRequests && isTabDirty(tab);
  }

  if (isPageTab(tab) && tab.tabId === activeTabId) {
    return isActivePageTabDirty(
      tab.page,
      collectionSettingsDirty,
      environmentSettingsDirty,
      folderSettingsDirty
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
 * Request workspace: tab bar, editor, and response viewer.
 */
export function RequestEditor({ onEditVariables }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const { revealCollection, revealFolder } = useSidebarExpansion();
  const tabs = useAppSelector(selectTabs);
  const editSessionHiddenTabIds = useAppSelector(selectEditSessionHiddenTabIds);

  /**
   * Tab ids hidden from the tab bar during tab group edit mode.
   */
  const hiddenTabIds = useMemo(() => new Set(editSessionHiddenTabIds), [editSessionHiddenTabIds]);

  const activeTabId = useAppSelector(selectActiveTabId);
  const activePage = useAppSelector(selectActivePage);
  const activeMarkdownTab = useAppSelector(selectActiveMarkdownTab);
  const activeTab = tabs.find((tab) => tab.tabId === activeTabId);
  const isActivePageTab = activeTab != null && isPageTab(activeTab);
  const isActiveMarkdownTab = activeTab != null && isMarkdownTab(activeTab);
  const draft = useAppSelector(selectDraft);
  const response = useAppSelector(selectResponse);
  const sending = useAppSelector(selectSending);
  const testResults = useAppSelector(selectTestResults);
  const scriptLogs = useAppSelector(selectScriptLogs);
  const executionEvents = useAppSelector(selectExecutionEvents);
  const scriptError = useAppSelector(selectScriptError);
  const environments = useAppSelector(selectEnvironments);
  const collections = useAppSelector(selectCollections);
  const { teamHubs } = useTeamHubs();
  const activeEnvironmentId = useAppSelector(selectActiveEnvironmentId);
  const foldersByCollection = useAppSelector(selectFoldersByCollection);
  const requestsByCollection = useAppSelector(selectRequestsByCollection);
  const selectedCollectionId = useAppSelector(selectSelectedCollectionId);
  const collectionSettingsDirty = useAppSelector(selectCollectionSettingsDirty);
  const environmentSettingsDirty = useAppSelector(selectEnvironmentSettingsDirty);
  const folderSettingsDirty = useAppSelector(selectFolderSettingsDirty);
  const showRequestEditor = useAppSelector(selectShowRequestEditor);
  const showResponseEditor = useAppSelector(selectShowResponseEditor);
  const persistedSplitHeight = useAppSelector(selectRequestEditorSplitHeight);
  const showSplitLayout = showRequestEditor && showResponseEditor;

  /**
   * Keeps the native Edit menu Create Tab Group item in sync with open saved request tabs.
   */
  useEffect(() => {
    const hasOpenSavedRequests = tabs.some((tab) => isRequestTab(tab) && tab.draft.id != null);
    void window.api.setTabGroupAvailable(hasOpenSavedRequests);
  }, [tabs]);

  const hasOpenTabs = tabs.length > 0;
  const [closeTabPrompt, setCloseTabPrompt] = useState<CloseTabPrompt | null>(null);
  const [closeManyPrompt, setCloseManyPrompt] = useState<CloseManyPrompt | null>(null);
  const [closeTabDontAskAgain, setCloseTabDontAskAgain] = useState(false);
  const [closeManyDontAskAgain, setCloseManyDontAskAgain] = useState(false);
  const splitRef = useRef<HTMLElement>(null);

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

  const activeCollectionId =
    draft.collection_id ?? activeMarkdownTab?.collectionId ?? selectedCollectionId;
  const activeCollection =
    activeCollectionId != null ? collections.find((c) => c.id === activeCollectionId) : undefined;
  const activeEnvironment =
    activeEnvironmentId != null
      ? environments.find((env) => env.id === activeEnvironmentId)
      : undefined;
  const globalVariables = useAppSelector((state) => state.settings.general.globalVariables);
  const warnWhenClosingUnsavedRequests = useAppSelector(
    (state) => state.settings.general.warnWhenClosingUnsavedRequests
  );

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
   * Closes tabs immediately without prompting, including collection-runner cleanup.
   *
   * @param tabIds - Tabs to close.
   */
  const closeTabsImmediately = (tabIds: string[]): void => {
    for (const tabId of tabIds) {
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
        dispatch(closeTab(tabId));
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
        warnWhenClosingUnsavedRequests
      )
    ).length;

    if (dirtyCount > 0) {
      setCloseManyPrompt({ tabIds: uniqueTabIds, dirtyCount });
      return;
    }

    closeTabsImmediately(uniqueTabIds);
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
            warnWhenClosingUnsavedRequests
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

    if (isRequestTab(tab) && warnWhenClosingUnsavedRequests && isTabDirty(tab)) {
      setCloseTabPrompt({ tabId, name: tab.draft.name });
      return;
    }

    if (
      tabId === activeTabId &&
      isPageTab(tab) &&
      isActivePageTabDirty(
        tab.page,
        collectionSettingsDirty,
        environmentSettingsDirty,
        folderSettingsDirty
      )
    ) {
      setCloseTabPrompt({
        tabId,
        name: pageTabCloseName(tab.page, collections, environments, teamHubs)
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

    void dispatch(closeRequestTab(tabId));
  };

  return (
    <>
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        hiddenTabIds={hiddenTabIds.size > 0 ? hiddenTabIds : undefined}
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
          ) : (
            <>
              {showRequestEditor ? (
                <section
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
                    axis="both"
                    className={showSplitLayout ? 'h-full min-h-0' : 'min-h-0 flex-1'}
                  >
                    <Editor
                      key={`editor-${activeTabId}`}
                      tabId={activeTabId}
                      draft={draft}
                      requestTabContext={requestTabContext}
                      onChange={(next) => dispatch(setActiveDraft(next))}
                      onSend={() => void dispatch(sendRequest())}
                      onCancel={() => void dispatch(cancelRequest(activeTabId))}
                      sending={sending}
                      variables={activeVariables}
                      collectionName={activeCollectionName}
                      folderName={activeFolderName}
                      onEditVariables={onEditVariables}
                      onCollectionClick={() => {
                        if (activeCollectionId == null) return;
                        dispatch(focusSidebarItem({ collectionId: activeCollectionId }));
                        revealCollection(activeCollectionId);
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
                    requestUrl={draft.url}
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
            <label htmlFor="request-close-tab-dont-ask-again" className="text-[16px] text-muted">
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
                  if (tab && isPageTab(tab)) {
                    dispatch(closeTab(closeTabPrompt.tabId));
                  } else if (tab && isMarkdownTab(tab)) {
                    void dispatch(closeMarkdownTab(closeTabPrompt.tabId));
                  } else {
                    void dispatch(closeRequestTab(closeTabPrompt.tabId));
                  }
                  setCloseTabPrompt(null);
                  setCloseTabDontAskAgain(false);
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
            <label
              htmlFor="request-close-many-tabs-dont-ask-again"
              className="text-[16px] text-muted"
            >
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

                  closeTabsImmediately(closeManyPrompt.tabIds);
                  setCloseManyPrompt(null);
                  setCloseManyDontAskAgain(false);
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
