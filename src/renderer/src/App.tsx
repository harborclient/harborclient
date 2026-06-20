import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import logoUrl from '@images/logo-square.png';
import type { SavedRequest, Variable } from '#/shared/types';
import { useAppStore } from '#/renderer/src/store';
import { getDirtyTabs, isTabDirty } from '#/renderer/src/store/drafts';
import { CollectionSettings } from '#/renderer/src/ui/CollectionSettings';
import { EnvironmentSettings } from '#/renderer/src/ui/EnvironmentSettings';
import { Settings } from '#/renderer/src/ui/Settings';
import { Sidebar } from '#/renderer/src/ui/Sidebar';
import { TabBar } from '#/renderer/src/ui/TabBar';
import { RequestEditor } from '#/renderer/src/ui/RequestEditor';
import { ResponseViewer } from '#/renderer/src/ui/ResponseViewer';
import { TitleBar } from '#/renderer/src/ui/TitleBar';
import { Footer } from '#/renderer/src/ui/Footer';
import { ConsolePanel } from '#/renderer/src/ui/ConsolePanel';
import { SegmentedTabs } from '#/renderer/src/components/SegmentedTabs';
import { field, primaryButton, secondaryButton } from '#/renderer/src/ui/classes';

const isMac = window.platform === 'darwin';

type CollectionModalMode = 'create' | 'create-and-save' | null;
type CollectionModalTab = 'create' | 'import';

interface CloseTabPrompt {
  tabId: string;
  name: string;
}

/**
 * Merges collection and environment variables; environment wins on duplicate keys.
 *
 * @param collectionVars - Collection-scoped variables.
 * @param envVars - Environment-scoped variables.
 * @returns Combined variable list for editor highlighting.
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
 * Root application layout: sidebar, request editor, and response viewer.
 */
export default function App(): JSX.Element {
  const store = useAppStore();
  const { selectedCollectionId, saveRequest } = store;
  const [collectionModal, setCollectionModal] = useState<CollectionModalMode>(null);
  const [collectionModalTab, setCollectionModalTab] = useState<CollectionModalTab>('create');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [closeTabPrompt, setCloseTabPrompt] = useState<CloseTabPrompt | null>(null);
  const [quitPrompt, setQuitPrompt] = useState<string[] | null>(null);
  const [configuringCollectionId, setConfiguringCollectionId] = useState<number | null>(null);
  const [collectionSettingsDirty, setCollectionSettingsDirty] = useState(false);
  const [configuringEnvironmentId, setConfiguringEnvironmentId] = useState<number | null>(null);
  const [environmentSettingsDirty, setEnvironmentSettingsDirty] = useState(false);
  const [showEnvironmentModal, setShowEnvironmentModal] = useState(false);
  const [newEnvironmentName, setNewEnvironmentName] = useState('');
  const [pendingLoadRequest, setPendingLoadRequest] = useState<SavedRequest | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showConsole, setShowConsole] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [appVersion, setAppVersion] = useState('');

  /** Ref to store.tabs to avoid unnecessary re-renders. */
  const tabsRef = useRef(store.tabs);
  useEffect(() => {
    tabsRef.current = store.tabs;
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
  const activeVariables = mergeVariables(
    activeCollection?.variables ?? [],
    activeEnvironment?.variables ?? []
  );
  const activeCollectionName = activeCollection?.name;

  /** Opens the active collection's settings to edit variables. */
  const handleEditVariables = useCallback((): void => {
    if (activeCollectionId == null) return;
    setShowSettings(false);
    setConfiguringEnvironmentId(null);
    setEnvironmentSettingsDirty(false);
    setCollectionSettingsDirty(false);
    setConfiguringCollectionId(activeCollectionId);
  }, [activeCollectionId]);

  /** Closes application settings. */
  const closeAppSettings = useCallback((): void => {
    setShowSettings(false);
  }, []);

  /** Closes collection settings and clears dirty tracking. */
  const closeCollectionSettings = useCallback((): void => {
    setConfiguringCollectionId(null);
    setCollectionSettingsDirty(false);
  }, []);

  /** Closes environment settings and clears dirty tracking. */
  const closeEnvironmentSettings = useCallback((): void => {
    setConfiguringEnvironmentId(null);
    setEnvironmentSettingsDirty(false);
  }, []);

  /**
   * Loads a saved request from the sidebar, closing settings overlays first.
   */
  const handleLoadRequest = useCallback(
    (req: SavedRequest): void => {
      if (
        (configuringCollectionId != null && collectionSettingsDirty) ||
        (configuringEnvironmentId != null && environmentSettingsDirty)
      ) {
        setPendingLoadRequest(req);
        return;
      }
      closeAppSettings();
      closeCollectionSettings();
      closeEnvironmentSettings();
      store.loadRequest(req);
    },
    [
      configuringCollectionId,
      collectionSettingsDirty,
      configuringEnvironmentId,
      environmentSettingsDirty,
      closeAppSettings,
      closeCollectionSettings,
      closeEnvironmentSettings,
      store
    ]
  );

  /**
   * Saves the current draft, prompting for a new collection when none exists.
   */
  const handleSave = useCallback(async (): Promise<void> => {
    if (selectedCollectionId == null) {
      setNewCollectionName('');
      setCollectionModalTab('create');
      setCollectionModal('create-and-save');
      return;
    }
    try {
      await saveRequest();
      toast.success('Request saved');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save request');
    }
  }, [selectedCollectionId, saveRequest]);

  /**
   * Creates a collection, optionally saving the current draft into it.
   */
  const handleCollectionModalSubmit = async (): Promise<void> => {
    const name = newCollectionName.trim();
    if (!name) return;
    try {
      const collection = await store.createCollection(name);
      if (collectionModal === 'create-and-save') {
        await store.saveRequest(collection.id);
        toast.success('Request saved');
      }
      setCollectionModal(null);
      setNewCollectionName('');
      setCollectionModalTab('create');
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : collectionModal === 'create-and-save'
            ? 'Failed to save request'
            : 'Failed to create collection'
      );
    }
  };

  /**
   * Imports a collection from a JSON file selected via a native dialog.
   */
  const handleImportCollection = useCallback(async (): Promise<void> => {
    try {
      const collection = await store.importCollection();
      if (!collection) return;

      toast.success('Collection imported');
      setCollectionModal(null);
      setNewCollectionName('');
      setCollectionModalTab('create');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to import collection');
    }
  }, [store]);

  const closeCollectionModal = (): void => {
    setCollectionModal(null);
    setNewCollectionName('');
    setCollectionModalTab('create');
  };

  const closeEnvironmentModal = (): void => {
    setShowEnvironmentModal(false);
    setNewEnvironmentName('');
  };

  /**
   * Creates an environment from the modal form.
   */
  const handleEnvironmentModalSubmit = async (): Promise<void> => {
    const name = newEnvironmentName.trim();
    if (!name) return;
    try {
      await store.createEnvironment(name);
      toast.success('Environment created');
      closeEnvironmentModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create environment');
    }
  };

  useEffect(() => {
    const unsubscribe = window.api.onMenuAction((action) => {
      switch (action) {
        case 'new-request':
          store.newRequest();
          break;
        case 'new-collection':
          setNewCollectionName('');
          setCollectionModalTab('create');
          setCollectionModal('create');
          break;
        case 'import':
          void handleImportCollection();
          break;
        case 'save':
          void handleSave();
          break;
        case 'settings':
          setConfiguringCollectionId(null);
          setConfiguringEnvironmentId(null);
          setCollectionSettingsDirty(false);
          setEnvironmentSettingsDirty(false);
          setShowSettings(true);
          break;
        case 'about':
          setShowAbout(true);
          break;
      }
    });
    return unsubscribe;
  }, [store, handleImportCollection, handleSave]);

  useEffect(() => {
    if (!showAbout) return;
    let cancelled = false;
    window.api.getAppVersion().then((version) => {
      if (!cancelled) setAppVersion(version);
    });
    return () => {
      cancelled = true;
    };
  }, [showAbout]);

  useEffect(() => {
    const unsubscribe = window.api.onBeforeClose(() => {
      const dirtyTabs = getDirtyTabs(tabsRef.current);
      if (dirtyTabs.length === 0) {
        window.api.confirmClose(true);
        return;
      }
      setQuitPrompt(dirtyTabs.map((tab) => tab.draft.name));
    });
    return unsubscribe;
  }, []);

  /**
   * Closes a tab, prompting when it has unsaved changes.
   *
   * @param tabId - Tab to close.
   */
  const handleCloseTab = (tabId: string): void => {
    const tab = store.tabs.find((t) => t.tabId === tabId);
    if (tab && isTabDirty(tab)) {
      setCloseTabPrompt({ tabId, name: tab.draft.name });
      return;
    }
    store.closeTab(tabId);
  };

  const showImportTab = collectionModal === 'create';
  const configuringCollection = configuringCollectionId
    ? store.collections.find((c) => c.id === configuringCollectionId)
    : undefined;
  const configuringEnvironment = configuringEnvironmentId
    ? store.environments.find((env) => env.id === configuringEnvironmentId)
    : undefined;

  return (
    <div className={`flex h-screen flex-col ${isMac ? 'platform-darwin' : ''}`}>
      <TitleBar />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {showSidebar && (
          <Sidebar
            collections={store.collections}
            environments={store.environments}
            requestsByCollection={store.requestsByCollection}
            selectedCollectionId={store.selectedCollectionId}
            activeEnvironmentId={store.activeEnvironmentId}
            activeRequestId={store.draft.id}
            onSelectCollection={store.setSelectedCollectionId}
            onSelectEnvironment={store.setActiveEnvironmentId}
            onExpandCollection={store.refreshRequests}
            onAddCollection={() => {
              setNewCollectionName('');
              setCollectionModalTab('create');
              setCollectionModal('create');
            }}
            onAddEnvironment={() => {
              setNewEnvironmentName('');
              setShowEnvironmentModal(true);
            }}
            onConfigureCollection={(id) => {
              setShowSettings(false);
              setConfiguringEnvironmentId(null);
              setEnvironmentSettingsDirty(false);
              setCollectionSettingsDirty(false);
              setConfiguringCollectionId(id);
            }}
            onConfigureEnvironment={(id) => {
              setShowSettings(false);
              setConfiguringCollectionId(null);
              setCollectionSettingsDirty(false);
              setEnvironmentSettingsDirty(false);
              setConfiguringEnvironmentId(id);
            }}
            onDeleteCollection={store.deleteCollection}
            onDeleteEnvironment={store.deleteEnvironment}
            onExportCollection={async (id) => {
              const result = await store.exportCollection(id);
              if (!result.canceled) {
                toast.success('Collection exported');
              }
            }}
            onNewRequestInCollection={async (id) => {
              try {
                await store.newRequestInCollection(id);
              } catch (err) {
                alert(err instanceof Error ? err.message : 'Failed to create request');
              }
            }}
            onLoadRequest={handleLoadRequest}
            onDeleteRequest={store.deleteRequest}
          />
        )}

        <main className="flex min-w-0 flex-1 flex-col bg-surface">
          {showSettings ? (
            <Settings onClose={closeAppSettings} />
          ) : configuringCollection ? (
            <CollectionSettings
              collection={configuringCollection}
              onDirtyChange={setCollectionSettingsDirty}
              onSave={async (id, name, variables, headers, preRequestScript, postRequestScript) => {
                try {
                  await store.updateCollection(
                    id,
                    name,
                    variables,
                    headers,
                    preRequestScript,
                    postRequestScript
                  );
                  toast.success('Collection updated');
                } catch (err) {
                  alert(err instanceof Error ? err.message : 'Failed to update collection');
                }
              }}
              onClose={closeCollectionSettings}
            />
          ) : configuringEnvironment ? (
            <EnvironmentSettings
              environment={configuringEnvironment}
              onDirtyChange={setEnvironmentSettingsDirty}
              onSave={async (id, name, variables) => {
                try {
                  await store.updateEnvironment(id, name, variables);
                  toast.success('Environment updated');
                } catch (err) {
                  alert(err instanceof Error ? err.message : 'Failed to update environment');
                }
              }}
              onClose={closeEnvironmentSettings}
            />
          ) : (
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
              <RequestEditor
                key={`editor-${store.activeTabId}`}
                draft={store.draft}
                onChange={store.setDraft}
                onSend={() => void store.sendRequest()}
                sending={store.sending}
                variables={activeVariables}
                collectionName={activeCollectionName}
                onEditVariables={handleEditVariables}
              />
              <ResponseViewer
                key={`response-${store.activeTabId}`}
                response={store.response}
                sending={store.sending}
                testResults={store.testResults}
              />
            </>
          )}
        </main>

        <ConsolePanel
          entries={store.consoleEntries}
          open={showConsole}
          onClose={() => setShowConsole(false)}
          onClear={store.clearConsole}
        />
      </div>

      <Footer
        consoleOpen={showConsole}
        entryCount={store.consoleEntries.length}
        onToggleConsole={() => setShowConsole((open) => !open)}
        sidebarOpen={showSidebar}
        onToggleSidebar={() => setShowSidebar((open) => !open)}
      />

      {collectionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={closeCollectionModal}
        >
          <div
            className="w-96 rounded-lg border border-separator bg-surface p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="m-0 mb-1 text-[13px] font-semibold text-text">
              {showImportTab ? 'Add collection' : 'New collection'}
            </h2>
            {collectionModal === 'create-and-save' && (
              <p className="mb-3 text-[12px] text-muted">
                Create a collection to save this request into.
              </p>
            )}

            {showImportTab && (
              <SegmentedTabs
                value={collectionModalTab}
                onChange={setCollectionModalTab}
                fullWidth
                className="mb-3"
                tabs={[
                  { value: 'create', label: 'Create new' },
                  { value: 'import', label: 'Import from file' }
                ]}
              />
            )}

            {collectionModalTab === 'create' || !showImportTab ? (
              <>
                <input
                  className={`${field} w-full`}
                  type="text"
                  autoFocus
                  placeholder="Collection name"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleCollectionModalSubmit();
                    if (e.key === 'Escape') closeCollectionModal();
                  }}
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button className={secondaryButton} onClick={closeCollectionModal}>
                    Cancel
                  </button>
                  <button
                    className={primaryButton}
                    onClick={() => void handleCollectionModalSubmit()}
                    disabled={!newCollectionName.trim()}
                  >
                    {collectionModal === 'create-and-save' ? 'Create & Save' : 'Create'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mb-4 text-[12px] text-muted">
                  Choose a HarborClient collection export (.json) to import all saved requests.
                </p>
                <div className="flex justify-end gap-2">
                  <button className={secondaryButton} onClick={closeCollectionModal}>
                    Cancel
                  </button>
                  <button className={primaryButton} onClick={() => void handleImportCollection()}>
                    Import .json
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showEnvironmentModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={closeEnvironmentModal}
        >
          <div
            className="w-96 rounded-lg border border-separator bg-surface p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="m-0 mb-1 text-[13px] font-semibold text-text">New environment</h2>
            <input
              className={`${field} mt-3 w-full`}
              type="text"
              autoFocus
              placeholder="Environment name"
              value={newEnvironmentName}
              onChange={(e) => setNewEnvironmentName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleEnvironmentModalSubmit();
                if (e.key === 'Escape') closeEnvironmentModal();
              }}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button className={secondaryButton} onClick={closeEnvironmentModal}>
                Cancel
              </button>
              <button
                className={primaryButton}
                onClick={() => void handleEnvironmentModalSubmit()}
                disabled={!newEnvironmentName.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingLoadRequest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setPendingLoadRequest(null)}
        >
          <div
            className="w-96 rounded-lg border border-separator bg-surface p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="m-0 mb-1 text-[13px] font-semibold text-text">Unsaved changes</h2>
            <p className="mb-4 text-[12px] text-muted">
              Settings have unsaved changes. Open request without saving?
            </p>
            <div className="flex justify-end gap-2">
              <button className={secondaryButton} onClick={() => setPendingLoadRequest(null)}>
                Cancel
              </button>
              <button
                className={primaryButton}
                onClick={() => {
                  const req = pendingLoadRequest;
                  setPendingLoadRequest(null);
                  closeAppSettings();
                  closeCollectionSettings();
                  closeEnvironmentSettings();
                  store.loadRequest(req);
                }}
              >
                Open without saving
              </button>
            </div>
          </div>
        </div>
      )}

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

      {quitPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => {
            setQuitPrompt(null);
            window.api.confirmClose(false);
          }}
        >
          <div
            className="w-96 rounded-lg border border-separator bg-surface p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="m-0 mb-1 text-[13px] font-semibold text-text">Unsaved changes</h2>
            <p className="mb-4 text-[12px] text-muted">
              {quitPrompt.length === 1 ? (
                <>&ldquo;{quitPrompt[0]}&rdquo; has unsaved changes. Quit without saving?</>
              ) : (
                <>{quitPrompt.length} requests have unsaved changes. Quit without saving?</>
              )}
            </p>
            <div className="flex justify-end gap-2">
              <button
                className={secondaryButton}
                onClick={() => {
                  setQuitPrompt(null);
                  window.api.confirmClose(false);
                }}
              >
                Cancel
              </button>
              <button
                className={primaryButton}
                onClick={() => {
                  setQuitPrompt(null);
                  window.api.confirmClose(true);
                }}
              >
                Quit without saving
              </button>
            </div>
          </div>
        </div>
      )}

      {showAbout && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowAbout(false)}
        >
          <div
            className="w-80 rounded-lg border border-separator bg-surface p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center">
              <img src={logoUrl} alt="HarborClient" className="mb-4 h-16 w-16 rounded-xl" />
              <h2 className="m-0 mb-1 text-[15px] font-semibold text-text">HarborClient</h2>
              {appVersion && <p className="m-0 text-[12px] text-muted">Version {appVersion}</p>}
              <a
                href="https://harborclient.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 text-[14px] text-accent hover:underline"
              >
                Documentation
              </a>
            </div>
            <div className="mt-6 flex justify-center">
              <button className={primaryButton} onClick={() => setShowAbout(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <Toaster
        position="bottom-center"
        containerStyle={{ bottom: 16 }}
        toastOptions={{
          duration: 2000,
          style: {
            background: 'var(--mac-control)',
            color: 'var(--mac-text)',
            border: '1px solid var(--mac-separator)',
            fontSize: '13px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }
        }}
      />
    </div>
  );
}
