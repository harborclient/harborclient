import { useMemo, useRef, useState, type JSX } from 'react';
import type { RequestTabContext, ResponseTabContext } from '#/shared/plugin/types';
import type { Variable } from '#/shared/types';
import { isPageTab, isRequestTab, isTabDirty } from '#/renderer/src/store/drafts';
import {
  toPluginHttpResponse,
  toPluginRequestDraft,
  toPluginRequestTabContext,
  pluginRequestKey
} from '#/renderer/src/plugins/pluginContextAdapters';
import { buildRuntimeVars } from '#/renderer/src/scripting/scriptOrchestration';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActiveEnvironmentId,
  selectActivePage,
  selectActiveTabId,
  selectCollections,
  selectDraft,
  selectEnvironments,
  selectFoldersByCollection,
  selectRequestsByCollection,
  selectResponse,
  selectSelectedCollectionId,
  selectSending,
  selectTabs,
  selectTestResults
} from '#/renderer/src/store/selectors';
import {
  selectCollectionSettingsDirty,
  selectEnvironmentSettingsDirty,
  selectShowRequestEditor,
  selectShowResponseEditor
} from '#/renderer/src/store/slices/navigationSlice';
import {
  setActiveDraft,
  newTab,
  setActiveTab,
  closeTab
} from '#/renderer/src/store/slices/tabsSlice';
import {
  sendRequest,
  cancelRequest,
  closeRequestTab,
  focusSidebarItem
} from '#/renderer/src/store/thunks';
import { useSidebarExpansion } from '#/renderer/src/ui/Sidebar/useSidebarExpansion';
import { Button } from '@harborclient/sdk/components';
import { Modal, ModalFooter } from '@harborclient/sdk/components';
import { ResizeHandle, useResizable } from '@harborclient/sdk/components';
import { Editor } from './Editor';
import { NoOpenRequests } from './NoOpenRequests';
import { isActivePageTabDirty, pageTabCloseName } from './pageTabCloseHelpers';
import { PageTabContent } from './PageTabContent';
import { ResponseEditor } from '../ResponseEditor';
import { TabBar } from './TabBar';

interface Props {
  /**
   * Opens collection settings to edit variables.
   */
  onEditVariables: () => void;
}

interface CloseTabPrompt {
  tabId: string;
  name: string;
}

/**
 * Merges global, collection, and environment variables; higher scopes win on duplicate keys.
 */
function mergeVariables(
  globalVars: Variable[],
  collectionVars: Variable[],
  envVars: Variable[]
): Variable[] {
  const map = new Map<string, Variable>();
  for (const variable of globalVars) {
    const key = variable.key.trim();
    if (key) map.set(key, variable);
  }
  for (const variable of collectionVars) {
    const key = variable.key.trim();
    if (key) map.set(key, variable);
  }
  for (const variable of envVars) {
    const key = variable.key.trim();
    if (key) map.set(key, variable);
  }
  return Array.from(map.values());
}

/**
 * Request workspace: tab bar, editor, and response viewer.
 */
export function RequestEditor({ onEditVariables }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const { revealCollection, revealFolder } = useSidebarExpansion();
  const tabs = useAppSelector(selectTabs);
  const activeTabId = useAppSelector(selectActiveTabId);
  const activePage = useAppSelector(selectActivePage);
  const activeTab = tabs.find((tab) => tab.tabId === activeTabId);
  const isActivePageTab = activeTab != null && isPageTab(activeTab);
  const draft = useAppSelector(selectDraft);
  const response = useAppSelector(selectResponse);
  const sending = useAppSelector(selectSending);
  const testResults = useAppSelector(selectTestResults);
  const environments = useAppSelector(selectEnvironments);
  const collections = useAppSelector(selectCollections);
  const activeEnvironmentId = useAppSelector(selectActiveEnvironmentId);
  const foldersByCollection = useAppSelector(selectFoldersByCollection);
  const requestsByCollection = useAppSelector(selectRequestsByCollection);
  const selectedCollectionId = useAppSelector(selectSelectedCollectionId);
  const collectionSettingsDirty = useAppSelector(selectCollectionSettingsDirty);
  const environmentSettingsDirty = useAppSelector(selectEnvironmentSettingsDirty);
  const showRequestEditor = useAppSelector(selectShowRequestEditor);
  const showResponseEditor = useAppSelector(selectShowResponseEditor);
  const showSplitLayout = showRequestEditor && showResponseEditor;

  const hasOpenTabs = tabs.length > 0;
  const [closeTabPrompt, setCloseTabPrompt] = useState<CloseTabPrompt | null>(null);
  const splitRef = useRef<HTMLElement>(null);
  const {
    size: editorHeight,
    minSize: editorMinSize,
    maxSize: editorMaxSize,
    onResizeStart,
    onKeyboardResize
  } = useResizable({
    axis: 'y',
    direction: 1,
    defaultSize: 340,
    minSize: 160,
    getMaxSize: () => (splitRef.current?.parentElement?.clientHeight ?? 600) - 160,
    storageKey: 'hc.requestEditorHeight'
  });

  const activeCollectionId = draft.collection_id ?? selectedCollectionId;
  const activeCollection =
    activeCollectionId != null ? collections.find((c) => c.id === activeCollectionId) : undefined;
  const activeEnvironment =
    activeEnvironmentId != null
      ? environments.find((env) => env.id === activeEnvironmentId)
      : undefined;
  const globalVariables = useAppSelector((state) => state.settings.general.globalVariables);

  /**
   * Merges global, collection, and environment variables for editor substitution.
   */
  const activeVariables = useMemo(
    () =>
      mergeVariables(
        globalVariables,
        activeCollection?.variables ?? [],
        activeEnvironment?.variables ?? []
      ),
    [globalVariables, activeCollection, activeEnvironment]
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
  /**
   * Resolves the folder id for the active draft from saved state or draft fields.
   */
  const activeFolderId = useMemo(() => {
    if (activeCollectionId == null) return null;
    if (draft.id != null) {
      const saved = (requestsByCollection[activeCollectionId] ?? []).find(
        (request) => request.id === draft.id
      );
      if (saved) return saved.folder_id;
    }
    return draft.folder_id ?? null;
  }, [draft.folder_id, draft.id, activeCollectionId, requestsByCollection]);
  /**
   * Looks up the folder name for breadcrumb display in the request editor.
   */
  const activeFolderName = useMemo(() => {
    if (activeFolderId == null || activeCollectionId == null) return undefined;
    const folders = foldersByCollection[activeCollectionId] ?? [];
    return folders.find((folder) => folder.id === activeFolderId)?.name;
  }, [activeFolderId, activeCollectionId, foldersByCollection]);

  /**
   * Closes a tab, prompting when it has unsaved changes.
   */
  const handleCloseTab = (tabId: string): void => {
    const tab = tabs.find((t) => t.tabId === tabId);
    if (!tab) {
      return;
    }

    if (isRequestTab(tab) && isTabDirty(tab)) {
      setCloseTabPrompt({ tabId, name: tab.draft.name });
      return;
    }

    if (
      tabId === activeTabId &&
      isPageTab(tab) &&
      isActivePageTabDirty(tab.page, collectionSettingsDirty, environmentSettingsDirty)
    ) {
      setCloseTabPrompt({
        tabId,
        name: pageTabCloseName(tab.page, collections, environments)
      });
      return;
    }

    if (isPageTab(tab)) {
      dispatch(closeTab(tabId));
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
        onNew={() => dispatch(newTab())}
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
          ) : (
            <>
              {showRequestEditor ? (
                <section
                  aria-label="Request editor"
                  ref={splitRef}
                  style={showSplitLayout ? { height: editorHeight } : undefined}
                  className={
                    showSplitLayout
                      ? 'shrink-0 overflow-auto'
                      : 'flex min-h-0 flex-1 flex-col overflow-auto'
                  }
                >
                  <Editor
                    key={`editor-${activeTabId}`}
                    tabId={activeTabId}
                    draft={draft}
                    requestTabContext={requestTabContext}
                    onChange={(next) => dispatch(setActiveDraft(next))}
                    onSend={() => void dispatch(sendRequest())}
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
                <section aria-label="Response" className="flex min-h-0 flex-1 flex-col">
                  <ResponseEditor
                    key={`response-${activeTabId}`}
                    response={response}
                    responseTabContext={responseTabContext}
                    sending={sending}
                    testResults={testResults}
                    requestUrl={draft.url}
                    onCancel={() => void dispatch(cancelRequest(activeTabId))}
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
          onClose={() => setCloseTabPrompt(null)}
          labelledBy="request-close-tab-title"
          title="Unsaved changes"
          description={
            <>&ldquo;{closeTabPrompt.name}&rdquo; has unsaved changes. Close without saving?</>
          }
        >
          <ModalFooter>
            <Button
              onClick={() => {
                const tab = tabs.find((entry) => entry.tabId === closeTabPrompt.tabId);
                if (tab && isPageTab(tab)) {
                  dispatch(closeTab(closeTabPrompt.tabId));
                } else {
                  void dispatch(closeRequestTab(closeTabPrompt.tabId));
                }
                setCloseTabPrompt(null);
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
