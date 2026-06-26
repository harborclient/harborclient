import { useMemo, useRef, useState, type JSX } from 'react';
import type { RequestTabContext, ResponseTabContext } from '#/shared/plugin/types';
import type { Variable } from '#/shared/types';
import { isTabDirty } from '#/renderer/src/store/drafts';
import {
  toPluginHttpResponse,
  toPluginRequestDraft,
  toPluginRequestTabContext
} from '#/renderer/src/plugins/pluginContextAdapters';
import { buildRuntimeVars } from '#/renderer/src/scripting/scriptOrchestration';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActiveEnvironmentId,
  selectActiveTabId,
  selectCollections,
  selectDraft,
  selectFoldersByCollection,
  selectRequestsByCollection,
  selectEnvironments,
  selectResponse,
  selectSelectedCollectionId,
  selectSending,
  selectTabs,
  selectTestResults
} from '#/renderer/src/store/selectors';
import { setActiveDraft, newTab, setActiveTab } from '#/renderer/src/store/slices/tabsSlice';
import { setActiveEnvironmentId } from '#/renderer/src/store/slices/environmentsSlice';
import {
  sendRequest,
  cancelRequest,
  closeRequestTab,
  focusSidebarItem
} from '#/renderer/src/store/thunks';
import { useSidebarExpansion } from '#/renderer/src/ui/Sidebar/useSidebarExpansion';
import { Button } from '#/renderer/src/components/Button';
import { Modal, ModalFooter } from '#/renderer/src/components/Modal';
import { ResizeHandle, useResizable } from '#/renderer/src/components/Resizable';
import { Editor } from './Editor';
import { Response } from './Response';
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
 * Merges collection and environment variables; environment wins on duplicate keys.
 */
function mergeVariables(collectionVars: Variable[], envVars: Variable[]): Variable[] {
  const map = new Map<string, Variable>();
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
export function Request({ onEditVariables }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const { revealCollection, revealFolder } = useSidebarExpansion();
  const tabs = useAppSelector(selectTabs);
  const activeTabId = useAppSelector(selectActiveTabId);
  const draft = useAppSelector(selectDraft);
  const response = useAppSelector(selectResponse);
  const sending = useAppSelector(selectSending);
  const testResults = useAppSelector(selectTestResults);
  const environments = useAppSelector(selectEnvironments);
  const activeEnvironmentId = useAppSelector(selectActiveEnvironmentId);
  const collections = useAppSelector(selectCollections);
  const foldersByCollection = useAppSelector(selectFoldersByCollection);
  const requestsByCollection = useAppSelector(selectRequestsByCollection);
  const selectedCollectionId = useAppSelector(selectSelectedCollectionId);

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

  /**
   * Merges collection and environment variables; environment wins on duplicate keys.
   */
  const activeVariables = useMemo(
    () => mergeVariables(activeCollection?.variables ?? [], activeEnvironment?.variables ?? []),
    [activeCollection, activeEnvironment]
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
      response: toPluginHttpResponse(response)
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
    if (tab && isTabDirty(tab)) {
      setCloseTabPrompt({ tabId, name: tab.draft.name });
      return;
    }
    void dispatch(closeRequestTab(tabId));
  };

  return (
    <>
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        environments={environments}
        activeEnvironmentId={activeEnvironmentId}
        onSelect={(tabId) => dispatch(setActiveTab(tabId))}
        onClose={handleCloseTab}
        onNew={() => dispatch(newTab())}
        onEnvironmentChange={(id) => dispatch(setActiveEnvironmentId(id))}
      />
      <div
        role="tabpanel"
        id={`request-tabpanel-${activeTabId}`}
        aria-labelledby={`request-tab-${activeTabId}`}
        className="flex min-h-0 flex-1 flex-col"
      >
        <section
          aria-label="Request editor"
          ref={splitRef}
          style={{ height: editorHeight }}
          className="shrink-0 overflow-auto"
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
                focusSidebarItem({ collectionId: activeCollectionId, folderId: activeFolderId })
              );
              revealFolder(activeCollectionId, activeFolderId);
            }}
          />
        </section>
        <ResizeHandle
          orientation="horizontal"
          value={editorHeight}
          min={editorMinSize}
          max={editorMaxSize}
          onResizeStart={onResizeStart}
          onKeyboardResize={onKeyboardResize}
          ariaLabel="Resize request editor"
        />
        <section aria-label="Response" className="flex min-h-0 flex-1 flex-col">
          <Response
            key={`response-${activeTabId}`}
            response={response}
            responseTabContext={responseTabContext}
            sending={sending}
            testResults={testResults}
            requestUrl={draft.url}
            onCancel={() => void dispatch(cancelRequest(activeTabId))}
          />
        </section>
      </div>

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
                void dispatch(closeRequestTab(closeTabPrompt.tabId));
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
