import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import logoUrl from '@images/logo-square.png';
import type { Collection, Environment, SavedRequest, TrustedInviteKey } from '#/shared/types';
import { getDirtyTabs } from '#/renderer/src/store/drafts';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActiveEnvironmentId,
  selectCollections,
  selectConsoleEntries,
  selectDraft,
  selectEnvironments,
  selectSelectedCollectionId,
  selectTabs
} from '#/renderer/src/store/selectors';
import { clearConsole } from '#/renderer/src/store/slices/consoleSlice';
import {
  createCollection,
  dispatchLoadRequest,
  dispatchNewRequest,
  importCollection,
  initializeStore,
  refreshCollections,
  refreshCollectionContents,
  saveRequest,
  updateCollection,
  updateEnvironment
} from '#/renderer/src/store/thunks';
import { Configuration } from '#/renderer/src/ui/Configuration';
import { Sidebar } from '#/renderer/src/ui/Sidebar';
import { Request } from '#/renderer/src/ui/Request';
import { TitleBar } from '#/renderer/src/ui/TitleBar';
import { BusyIndicator } from '#/renderer/src/ui/shared/BusyIndicator';
import { Footer } from '#/renderer/src/ui/Footer';
import { SegmentedTabs } from '#/renderer/src/components/SegmentedTabs';
import { field, primaryButton, secondaryButton } from '#/renderer/src/ui/shared/classes';

const isMac = window.platform === 'darwin';

type CollectionModalMode = 'create' | 'create-and-save' | null;
type CollectionModalTab = 'create' | 'import' | 'invite';

interface PendingInvite {
  collectionId: number;
  collectionName: string;
}

/**
 * Root application layout: sidebar, request editor, and response viewer.
 */
export default function App(): JSX.Element {
  const dispatch = useAppDispatch();
  const collections: Collection[] = useAppSelector(selectCollections);
  const environments: Environment[] = useAppSelector(selectEnvironments);
  const selectedCollectionId = useAppSelector(selectSelectedCollectionId);
  const activeEnvironmentId = useAppSelector(selectActiveEnvironmentId);
  const draft = useAppSelector(selectDraft);
  const consoleEntries = useAppSelector(selectConsoleEntries);
  const tabs = useAppSelector(selectTabs);

  const [collectionModal, setCollectionModal] = useState<CollectionModalMode>(null);
  const [collectionModalTab, setCollectionModalTab] = useState<CollectionModalTab>('create');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [inviteTokenInput, setInviteTokenInput] = useState('');
  const [pendingInvite, setPendingInvite] = useState<PendingInvite | null>(null);
  const [inviteToken, setInviteToken] = useState('');
  const [inviteTokenLoading, setInviteTokenLoading] = useState(false);
  const [inviteTokenError, setInviteTokenError] = useState<string | null>(null);
  const [inviteRecipientKid, setInviteRecipientKid] = useState('');
  const [inviteTrustedKeys, setInviteTrustedKeys] = useState<TrustedInviteKey[]>([]);
  const [inviteTrustedKeysLoading, setInviteTrustedKeysLoading] = useState(false);
  const [quitPrompt, setQuitPrompt] = useState<string[] | null>(null);
  const [configuringCollectionId, setConfiguringCollectionId] = useState<number | null>(null);
  const [collectionSettingsDirty, setCollectionSettingsDirty] = useState(false);
  const [configuringEnvironmentId, setConfiguringEnvironmentId] = useState<number | null>(null);
  const [environmentSettingsDirty, setEnvironmentSettingsDirty] = useState(false);
  const [pendingLoadRequest, setPendingLoadRequest] = useState<SavedRequest | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCertificates, setShowCertificates] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showConsole, setShowConsole] = useState(false);
  const [showVariables, setShowVariables] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [appVersion, setAppVersion] = useState('');
  const sidebarVisible = showSidebar && !showSettings && !showCertificates;

  /**
   * Ref to tabs to avoid unnecessary re-renders.
   */
  const tabsRef = useRef(tabs);
  useEffect(() => {
    tabsRef.current = tabs;
  });

  useEffect(() => {
    initializeStore(dispatch);
  }, [dispatch]);

  const activeCollectionId = draft.collection_id ?? selectedCollectionId;

  useEffect(() => {
    if (activeCollectionId != null) {
      void dispatch(refreshCollectionContents(activeCollectionId));
    }
  }, [dispatch, activeCollectionId]);

  const activeCollection =
    activeCollectionId != null
      ? collections.find((c: Collection) => c.id === activeCollectionId)
      : undefined;
  const activeEnvironment =
    activeEnvironmentId != null
      ? environments.find((env: Environment) => env.id === activeEnvironmentId)
      : undefined;

  /**
   * Opens the active collection's settings to edit variables.
   */
  const handleEditVariables = useCallback((): void => {
    if (activeCollectionId == null) return;
    setShowSettings(false);
    setShowCertificates(false);
    setConfiguringEnvironmentId(null);
    setEnvironmentSettingsDirty(false);
    setCollectionSettingsDirty(false);
    setConfiguringCollectionId(activeCollectionId);
  }, [activeCollectionId]);

  /**
   * Closes application settings.
   */
  const closeAppSettings = useCallback((): void => {
    setShowSettings(false);
  }, []);

  /**
   * Closes the certificates view.
   */
  const closeAppCertificates = useCallback((): void => {
    setShowCertificates(false);
  }, []);

  /**
   * Closes collection settings and clears dirty tracking.
   */
  const closeCollectionSettings = useCallback((): void => {
    setConfiguringCollectionId(null);
    setCollectionSettingsDirty(false);
  }, []);

  /**
   * Closes environment settings and clears dirty tracking.
   */
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
      closeAppCertificates();
      closeCollectionSettings();
      closeEnvironmentSettings();
      dispatchLoadRequest(dispatch, req);
    },
    [
      configuringCollectionId,
      collectionSettingsDirty,
      configuringEnvironmentId,
      environmentSettingsDirty,
      closeAppSettings,
      closeAppCertificates,
      closeCollectionSettings,
      closeEnvironmentSettings,
      dispatch
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
      await dispatch(saveRequest()).unwrap();
      toast.success('Request saved');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save request');
    }
  }, [selectedCollectionId, dispatch]);

  /**
   * Opens the invite modal and loads trusted keys for recipient selection.
   */
  const handleInviteCollection = useCallback(
    async (collectionId: number, collectionName: string): Promise<void> => {
      setPendingInvite({ collectionId, collectionName });
      setInviteToken('');
      setInviteTokenError(null);
      setInviteRecipientKid('');
      setInviteTokenLoading(false);
      setInviteTrustedKeysLoading(true);

      try {
        const keys = await window.api.listTrustedKeys();
        setInviteTrustedKeys(keys);
      } catch (err) {
        setInviteTokenError(err instanceof Error ? err.message : 'Failed to load trusted keys');
        setInviteTrustedKeys([]);
      } finally {
        setInviteTrustedKeysLoading(false);
      }
    },
    []
  );

  /**
   * Generates an invite token for the selected recipient.
   */
  const handleGenerateInvite = useCallback(async (): Promise<void> => {
    if (!pendingInvite || !inviteRecipientKid) return;

    setInviteTokenLoading(true);
    setInviteTokenError(null);
    setInviteToken('');

    try {
      const token = await window.api.createInviteToken(
        pendingInvite.collectionId,
        inviteRecipientKid
      );
      setInviteToken(token);
    } catch (err) {
      setInviteTokenError(err instanceof Error ? err.message : 'Failed to create invite token');
    } finally {
      setInviteTokenLoading(false);
    }
  }, [pendingInvite, inviteRecipientKid]);

  /**
   * Closes the invite modal and clears token state.
   */
  const closeInviteModal = useCallback((): void => {
    setPendingInvite(null);
    setInviteToken('');
    setInviteTokenError(null);
    setInviteTokenLoading(false);
    setInviteRecipientKid('');
    setInviteTrustedKeys([]);
    setInviteTrustedKeysLoading(false);
  }, []);

  /**
   * Creates a collection, optionally saving the current draft into it.
   */
  const handleCollectionModalSubmit = async (): Promise<void> => {
    const name = newCollectionName.trim();
    if (!name) return;
    try {
      const collection = await dispatch(createCollection(name)).unwrap();
      if (collectionModal === 'create-and-save') {
        await dispatch(saveRequest(collection.id)).unwrap();
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
      const collection = await dispatch(importCollection()).unwrap();
      if (!collection) return;

      toast.success('Collection imported');
      setCollectionModal(null);
      setNewCollectionName('');
      setCollectionModalTab('create');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to import collection');
    }
  }, [dispatch]);

  /**
   * Accepts an invite JWT and adds the embedded database connection.
   */
  const handleAcceptInvite = useCallback(async (): Promise<void> => {
    const token = inviteTokenInput.trim();
    if (!token) return;

    try {
      await window.api.acceptInvite(token);
      await dispatch(refreshCollections());
      toast.success('Shared connection added');
      setCollectionModal(null);
      setNewCollectionName('');
      setInviteTokenInput('');
      setCollectionModalTab('create');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to accept invite');
    }
  }, [dispatch, inviteTokenInput]);

  /**
   * Closes the collection modal.
   */
  const closeCollectionModal = (): void => {
    setCollectionModal(null);
    setNewCollectionName('');
    setInviteTokenInput('');
    setCollectionModalTab('create');
  };

  /**
   * Handles menu actions from the main process.
   */
  useEffect(() => {
    const unsubscribe = window.api.onMenuAction((action) => {
      switch (action) {
        case 'new-request':
          dispatchNewRequest(dispatch);
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
          setShowCertificates(false);
          setShowSettings(true);
          break;
        case 'certificates':
          setConfiguringCollectionId(null);
          setConfiguringEnvironmentId(null);
          setCollectionSettingsDirty(false);
          setEnvironmentSettingsDirty(false);
          setShowSettings(false);
          setShowCertificates(true);
          break;
        case 'about':
          setShowAbout(true);
          break;
      }
    });
    return unsubscribe;
  }, [dispatch, handleImportCollection, handleSave]);

  /**
   * Gets the application version from the main process.
   */
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
   * Handles before-close events from the main process.
   */
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

  const showImportTab = collectionModal === 'create';
  const configuringCollection = configuringCollectionId
    ? collections.find((c: Collection) => c.id === configuringCollectionId)
    : undefined;
  const configuringEnvironment = configuringEnvironmentId
    ? environments.find((env: Environment) => env.id === configuringEnvironmentId)
    : undefined;

  return (
    <div className={`flex h-screen flex-col overflow-hidden ${isMac ? 'platform-darwin' : ''}`}>
      <BusyIndicator />
      <TitleBar />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {sidebarVisible && (
          <Sidebar
            onAddCollection={() => {
              setNewCollectionName('');
              setCollectionModalTab('create');
              setCollectionModal('create');
            }}
            onConfigureCollection={(id) => {
              setShowSettings(false);
              setShowCertificates(false);
              setConfiguringEnvironmentId(null);
              setEnvironmentSettingsDirty(false);
              setCollectionSettingsDirty(false);
              setConfiguringCollectionId(id);
            }}
            onConfigureEnvironment={(id) => {
              setShowSettings(false);
              setShowCertificates(false);
              setConfiguringCollectionId(null);
              setCollectionSettingsDirty(false);
              setEnvironmentSettingsDirty(false);
              setConfiguringEnvironmentId(id);
            }}
            onInviteCollection={(collectionId, collectionName) => {
              void handleInviteCollection(collectionId, collectionName);
            }}
            onLoadRequest={handleLoadRequest}
          />
        )}

        <main className="flex min-w-0 flex-1 flex-col bg-surface">
          {showSettings || showCertificates || configuringCollection || configuringEnvironment ? (
            <Configuration
              showSettings={showSettings}
              onCloseAppSettings={closeAppSettings}
              showCertificates={showCertificates}
              onCloseCertificates={closeAppCertificates}
              collection={configuringCollection}
              onCollectionDirtyChange={setCollectionSettingsDirty}
              onCollectionSave={async (
                id,
                name,
                variables,
                headers,
                preRequestScript,
                postRequestScript,
                connectionId
              ) => {
                try {
                  const result = await dispatch(
                    updateCollection({
                      id,
                      name,
                      variables,
                      headers,
                      preRequestScript,
                      postRequestScript,
                      connectionId
                    })
                  ).unwrap();
                  if (result.id !== id) {
                    setConfiguringCollectionId(result.id);
                  }
                  toast.success('Collection updated');
                } catch (err) {
                  alert(err instanceof Error ? err.message : 'Failed to update collection');
                }
              }}
              onCloseCollectionSettings={closeCollectionSettings}
              environment={configuringEnvironment}
              onEnvironmentDirtyChange={setEnvironmentSettingsDirty}
              onEnvironmentSave={async (id, name, variables) => {
                try {
                  await dispatch(updateEnvironment({ id, name, variables })).unwrap();
                  toast.success('Environment updated');
                } catch (err) {
                  alert(err instanceof Error ? err.message : 'Failed to update environment');
                }
              }}
              onCloseEnvironmentSettings={closeEnvironmentSettings}
            />
          ) : (
            <Request onEditVariables={handleEditVariables} />
          )}
        </main>
      </div>

      <Footer
        consoleOpen={showConsole}
        entryCount={consoleEntries.length}
        onToggleConsole={() => {
          setShowConsole((open) => !open);
          setShowVariables(false);
        }}
        entries={consoleEntries}
        onClear={() => dispatch(clearConsole())}
        variablesOpen={showVariables}
        onToggleVariables={() => {
          setShowVariables((open) => !open);
          setShowConsole(false);
        }}
        collectionVariables={activeCollection?.variables ?? []}
        environmentVariables={activeEnvironment?.variables ?? []}
        collectionName={activeCollection?.name}
        environmentName={activeEnvironment?.name}
        sidebarOpen={sidebarVisible}
        onToggleSidebar={() => setShowSidebar((open) => !open)}
      />

      {collectionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={closeCollectionModal}
        >
          <div
            className="w-[32rem] rounded-lg border border-separator bg-surface p-4 shadow-xl"
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
                  { value: 'import', label: 'Import from file' },
                  { value: 'invite', label: 'Accept invite' }
                ]}
              />
            )}

            {collectionModalTab === 'invite' && showImportTab ? (
              <>
                <p className="mb-3 text-[12px] text-muted">
                  Paste an invite token from a trusted sender. Add their public key under File →
                  Certificates first. Restart HarborClient after accepting to load collections from
                  that database.
                </p>
                <textarea
                  className={`${field} min-h-28 w-full resize-y font-mono text-[12px]`}
                  autoFocus
                  placeholder="Paste invite token"
                  value={inviteTokenInput}
                  onChange={(e) => setInviteTokenInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') closeCollectionModal();
                  }}
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button className={secondaryButton} onClick={closeCollectionModal}>
                    Cancel
                  </button>
                  <button
                    className={primaryButton}
                    onClick={() => void handleAcceptInvite()}
                    disabled={!inviteTokenInput.trim()}
                  >
                    Accept
                  </button>
                </div>
              </>
            ) : collectionModalTab === 'create' || !showImportTab ? (
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

      {pendingInvite && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => closeInviteModal()}
        >
          <div
            className="w-[32rem] rounded-lg border border-separator bg-surface p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="m-0 mb-1 text-[13px] font-semibold text-text">Invite to collection</h2>
            <p className="mb-3 text-[12px] text-muted">
              Create an encrypted invite for &ldquo;{pendingInvite.collectionName}&rdquo;. Only the
              selected recipient can decrypt it. Invites expire after seven days.
            </p>
            {inviteTrustedKeysLoading ? (
              <p className="text-[12px] text-muted">Loading trusted keys…</p>
            ) : inviteTrustedKeys.length === 0 ? (
              <p className="text-[12px] text-muted">
                Add the recipient&apos;s public key under File → Certificates → Trusted keys before
                creating an invite.
              </p>
            ) : (
              <>
                <label className="mb-1 block text-[12px] font-medium text-text">Recipient</label>
                <select
                  className={`${field} mb-3 w-full`}
                  value={inviteRecipientKid}
                  disabled={inviteTokenLoading}
                  onChange={(event) => {
                    setInviteRecipientKid(event.target.value);
                    setInviteToken('');
                    setInviteTokenError(null);
                  }}
                >
                  <option value="">Select a recipient…</option>
                  {inviteTrustedKeys.map((key) => (
                    <option key={key.id} value={key.id}>
                      {key.label}
                    </option>
                  ))}
                </select>
              </>
            )}
            {inviteTokenError && <p className="mb-3 text-[12px] text-danger">{inviteTokenError}</p>}
            {inviteTokenLoading ? (
              <p className="text-[12px] text-muted">Generating invite token…</p>
            ) : inviteToken ? (
              <textarea
                className={`${field} min-h-28 w-full resize-y font-mono text-[12px]`}
                readOnly
                value={inviteToken}
                onFocus={(e) => e.target.select()}
              />
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button className={secondaryButton} onClick={closeInviteModal}>
                Close
              </button>
              {!inviteToken && inviteTrustedKeys.length > 0 && (
                <button
                  className={primaryButton}
                  disabled={!inviteRecipientKid || inviteTokenLoading || inviteTrustedKeysLoading}
                  onClick={() => void handleGenerateInvite()}
                >
                  Generate invite
                </button>
              )}
              {inviteToken && (
                <button
                  className={primaryButton}
                  disabled={inviteTokenLoading}
                  onClick={() => {
                    void navigator.clipboard.writeText(inviteToken).then(
                      () => toast.success('Invite token copied'),
                      () => toast.error('Failed to copy invite token')
                    );
                  }}
                >
                  Copy
                </button>
              )}
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
                  closeAppCertificates();
                  closeCollectionSettings();
                  closeEnvironmentSettings();
                  dispatchLoadRequest(dispatch, req);
                }}
              >
                Open without saving
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
