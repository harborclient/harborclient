import { useMemo, useRef, useState, type JSX } from 'react';
import type { Variable } from '#/shared/types';
import { isTabDirty } from '#/renderer/src/store/drafts';
import { useStore } from '#/renderer/src/store/StoreContext';
import { ResizeHandle, useResizable } from '#/renderer/src/components/Resizable';
import { primaryButton, secondaryButton } from '#/renderer/src/ui/shared/classes';
import { RequestEditor } from './RequestEditor';
import { ResponseViewer } from './ResponseViewer';
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
  const store = useStore();
  const [closeTabPrompt, setCloseTabPrompt] = useState<CloseTabPrompt | null>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  const { size: editorHeight, onResizeStart } = useResizable({
    axis: 'y',
    direction: 1,
    defaultSize: 340,
    minSize: 160,
    getMaxSize: () => (splitRef.current?.parentElement?.clientHeight ?? 600) - 160,
    storageKey: 'hc.requestEditorHeight'
  });

  const activeCollectionId = store.draft.collection_id ?? store.selectedCollectionId;
  const activeCollection =
    activeCollectionId != null
      ? store.collections.find((c) => c.id === activeCollectionId)
      : undefined;
  const activeEnvironment =
    store.activeEnvironmentId != null
      ? store.environments.find((env) => env.id === store.activeEnvironmentId)
      : undefined;

  const activeVariables = useMemo(
    () => mergeVariables(activeCollection?.variables ?? [], activeEnvironment?.variables ?? []),
    [activeCollection, activeEnvironment]
  );
  const activeCollectionName = activeCollection?.name;

  /**
   * Closes a tab, prompting when it has unsaved changes.
   */
  const handleCloseTab = (tabId: string): void => {
    const tab = store.tabs.find((t) => t.tabId === tabId);
    if (tab && isTabDirty(tab)) {
      setCloseTabPrompt({ tabId, name: tab.draft.name });
      return;
    }
    store.closeTab(tabId);
  };

  return (
    <>
      <TabBar
        tabs={store.tabs}
        activeTabId={store.activeTabId}
        environments={store.environments}
        activeEnvironmentId={store.activeEnvironmentId}
        onSelect={store.setActiveTab}
        onClose={handleCloseTab}
        onNew={store.newRequest}
        onEnvironmentChange={store.setActiveEnvironmentId}
      />
      <div ref={splitRef} style={{ height: editorHeight }} className="shrink-0 overflow-auto">
        <RequestEditor
          key={`editor-${store.activeTabId}`}
          draft={store.draft}
          onChange={store.setDraft}
          onSend={() => void store.sendRequest()}
          sending={store.sending}
          variables={activeVariables}
          collectionName={activeCollectionName}
          onEditVariables={onEditVariables}
        />
      </div>
      <ResizeHandle
        orientation="horizontal"
        onResizeStart={onResizeStart}
        ariaLabel="Resize request editor"
      />
      <ResponseViewer
        key={`response-${store.activeTabId}`}
        response={store.response}
        sending={store.sending}
        testResults={store.testResults}
      />

      {closeTabPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setCloseTabPrompt(null)}
        >
          <div
            className="w-96 rounded-lg border border-separator bg-surface p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="m-0 mb-1 text-[13px] font-semibold text-text">Unsaved changes</h2>
            <p className="mb-4 text-[12px] text-muted">
              &ldquo;{closeTabPrompt.name}&rdquo; has unsaved changes. Close without saving?
            </p>
            <div className="flex justify-end gap-2">
              <button className={secondaryButton} onClick={() => setCloseTabPrompt(null)}>
                Cancel
              </button>
              <button
                className={primaryButton}
                onClick={() => {
                  store.closeTab(closeTabPrompt.tabId);
                  setCloseTabPrompt(null);
                }}
              >
                Close without saving
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
