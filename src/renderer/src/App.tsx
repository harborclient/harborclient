import { useCallback, useEffect, useState, type JSX } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import logoUrl from '@images/logo-square.png';
import { useAppStore } from '#/renderer/src/store';
import { isTabDirty } from '#/renderer/src/store/drafts';
import { CollectionSettings } from '#/renderer/src/ui/CollectionSettings';
import { Settings } from '#/renderer/src/ui/Settings';
import { Sidebar } from '#/renderer/src/ui/Sidebar';
import { TabBar } from '#/renderer/src/ui/TabBar';
import { RequestEditor } from '#/renderer/src/ui/RequestEditor';
import { ResponseViewer } from '#/renderer/src/ui/ResponseViewer';
import { TitleBar } from '#/renderer/src/ui/TitleBar';
import {
  field,
  primaryButton,
  secondaryButton,
  segment,
  segmentGroup
} from '#/renderer/src/ui/classes';

const isMac = window.platform === 'darwin';

type CollectionModalMode = 'create' | 'create-and-save' | null;
type CollectionModalTab = 'create' | 'import';

interface CloseTabPrompt {
  tabId: string;
  name: string;
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
  const [configuringCollectionId, setConfiguringCollectionId] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const requests =
    store.selectedCollectionId != null
      ? (store.requestsByCollection[store.selectedCollectionId] ?? [])
      : [];

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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSave]);

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
        case 'settings':
          setConfiguringCollectionId(null);
          setShowSettings(true);
          break;
        case 'about':
          setShowAbout(true);
          break;
      }
    });
    return unsubscribe;
  }, [store, handleImportCollection]);

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

  return (
    <div className={`flex h-screen flex-col ${isMac ? 'platform-darwin' : ''}`}>
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          collections={store.collections}
          requests={requests}
          selectedCollectionId={store.selectedCollectionId}
          activeRequestId={store.draft.id}
          onSelectCollection={store.setSelectedCollectionId}
          onAddCollection={() => {
            setNewCollectionName('');
            setCollectionModalTab('create');
            setCollectionModal('create');
          }}
          onConfigureCollection={(id) => {
            setShowSettings(false);
            setConfiguringCollectionId(id);
          }}
          onDeleteCollection={store.deleteCollection}
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
          onLoadRequest={store.loadRequest}
          onDeleteRequest={store.deleteRequest}
        />

        <main className="flex min-w-0 flex-1 flex-col bg-surface">
          {showSettings ? (
            <Settings onClose={() => setShowSettings(false)} />
          ) : configuringCollection ? (
            <CollectionSettings
              collection={configuringCollection}
              onSave={async (id, name, variables) => {
                try {
                  await store.updateCollection(id, name, variables);
                  toast.success('Collection updated');
                } catch (err) {
                  alert(err instanceof Error ? err.message : 'Failed to update collection');
                }
              }}
              onClose={() => setConfiguringCollectionId(null)}
            />
          ) : (
            <>
              <TabBar
                tabs={store.tabs}
                activeTabId={store.activeTabId}
                onSelect={store.setActiveTab}
                onClose={handleCloseTab}
                onNew={store.newRequest}
              />
              <RequestEditor
                key={`editor-${store.activeTabId}`}
                draft={store.draft}
                onChange={store.setDraft}
                onSend={() => void store.sendRequest()}
                onSave={() => void handleSave()}
                sending={store.sending}
              />
              <ResponseViewer
                key={`response-${store.activeTabId}`}
                response={store.response}
                sending={store.sending}
              />
            </>
          )}
        </main>
      </div>

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
              <div className={`${segmentGroup} mb-3 w-full`}>
                <button
                  className={`${segment(collectionModalTab === 'create')} flex-1`}
                  onClick={() => setCollectionModalTab('create')}
                >
                  Create new
                </button>
                <button
                  className={`${segment(collectionModalTab === 'import')} flex-1`}
                  onClick={() => setCollectionModalTab('import')}
                >
                  Import from file
                </button>
              </div>
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
                  Choose a Harbor Client collection export (.json) to import all saved requests.
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
              <img src={logoUrl} alt="Harbor Client" className="mb-4 h-16 w-16 rounded-xl" />
              <h2 className="m-0 mb-1 text-[15px] font-semibold text-text">Harbor Client</h2>
              {appVersion && <p className="m-0 text-[12px] text-muted">Version {appVersion}</p>}
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
