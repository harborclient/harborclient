import { useEffect, type JSX } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import type { Collection, Environment } from '#/shared/types';
import { useBeforeClose } from '#/renderer/src/hooks/useBeforeClose';
import { useMenuActions } from '#/renderer/src/hooks/useMenuActions';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActiveEnvironmentId,
  selectCollections,
  selectConsoleEntries,
  selectDraft,
  selectEnvironments,
  selectFoldersByCollection,
  selectSelectedCollectionId
} from '#/renderer/src/store/selectors';
import { clearConsole } from '#/renderer/src/store/slices/consoleSlice';
import {
  closeOverlay,
  openCollectionSettings,
  openEnvironmentSettings,
  selectMainView,
  selectShowConsole,
  selectShowVariables,
  selectSidebarVisible,
  setCollectionSettingsDirty,
  setEnvironmentSettingsDirty,
  toggleConsole,
  toggleSidebar,
  toggleVariables
} from '#/renderer/src/store/slices/navigationSlice';
import { openCollectionModal, openInviteModal } from '#/renderer/src/store/slices/modalsSlice';
import {
  initializeStore,
  loadTrustedKeys,
  refreshCollectionContents,
  requestLoadRequest,
  updateCollection,
  updateEnvironment
} from '#/renderer/src/store/thunks';
import { AboutModal } from '#/renderer/src/ui/modals/AboutModal';
import { CollectionModal } from '#/renderer/src/ui/modals/CollectionModal';
import { InviteModal } from '#/renderer/src/ui/modals/InviteModal';
import { QuitPrompt } from '#/renderer/src/ui/modals/QuitPrompt';
import { UnsavedLoadPrompt } from '#/renderer/src/ui/modals/UnsavedLoadPrompt';
import { Configuration } from '#/renderer/src/ui/Configuration';
import { Sidebar } from '#/renderer/src/ui/Sidebar';
import { Request } from '#/renderer/src/ui/Request';
import { TitleBar } from '#/renderer/src/ui/TitleBar';
import { BusyIndicator } from '#/renderer/src/ui/shared/BusyIndicator';
import { Footer } from '#/renderer/src/ui/Footer';

const isMac = window.platform === 'darwin';

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
  const mainView = useAppSelector(selectMainView);
  const sidebarVisible = useAppSelector(selectSidebarVisible);
  const showConsole = useAppSelector(selectShowConsole);
  const showVariables = useAppSelector(selectShowVariables);
  const foldersByCollection = useAppSelector(selectFoldersByCollection);

  useMenuActions();
  useBeforeClose();

  /**
   * Initializes the store.
   */
  useEffect(() => {
    initializeStore(dispatch);
  }, [dispatch]);

  const activeCollectionId = draft.collection_id ?? selectedCollectionId;

  /**
   * Loads folders and requests for the active collection when that data has not
   * been fetched yet (lazy load on mount or collection change).
   */
  useEffect(() => {
    if (activeCollectionId == null) return;
    if (foldersByCollection[activeCollectionId] === undefined) {
      void dispatch(refreshCollectionContents(activeCollectionId));
    }
  }, [activeCollectionId, foldersByCollection, dispatch]);

  const activeCollection =
    activeCollectionId != null
      ? collections.find((c: Collection) => c.id === activeCollectionId)
      : undefined;
  const activeEnvironment =
    activeEnvironmentId != null
      ? environments.find((env: Environment) => env.id === activeEnvironmentId)
      : undefined;

  const configuringCollection =
    mainView.type === 'collection'
      ? collections.find((c: Collection) => c.id === mainView.id)
      : undefined;
  const configuringEnvironment =
    mainView.type === 'environment'
      ? environments.find((env: Environment) => env.id === mainView.id)
      : undefined;

  const showConfiguration =
    mainView.type === 'settings' ||
    mainView.type === 'certificates' ||
    configuringCollection != null ||
    configuringEnvironment != null;

  return (
    <div className={`flex h-screen flex-col overflow-hidden ${isMac ? 'platform-darwin' : ''}`}>
      <BusyIndicator />
      <TitleBar />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {sidebarVisible && (
          <Sidebar
            onAddCollection={() => dispatch(openCollectionModal({ mode: 'create' }))}
            onConfigureCollection={(id) => dispatch(openCollectionSettings(id))}
            onConfigureEnvironment={(id) => dispatch(openEnvironmentSettings(id))}
            onInviteCollection={(collectionId, collectionName) => {
              dispatch(openInviteModal({ collectionId, collectionName }));
              void dispatch(loadTrustedKeys());
            }}
            onLoadRequest={(req) => void dispatch(requestLoadRequest({ req }))}
          />
        )}

        <main className="flex min-w-0 flex-1 flex-col bg-surface">
          {showConfiguration ? (
            <Configuration
              showSettings={mainView.type === 'settings'}
              onCloseAppSettings={() => dispatch(closeOverlay())}
              showCertificates={mainView.type === 'certificates'}
              onCloseCertificates={() => dispatch(closeOverlay())}
              collection={configuringCollection}
              onCollectionDirtyChange={(dirty) => dispatch(setCollectionSettingsDirty(dirty))}
              onCollectionSave={async (
                id,
                name,
                variables,
                headers,
                preRequestScript,
                postRequestScript,
                auth,
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
                      auth,
                      connectionId
                    })
                  ).unwrap();
                  if (result.id !== id) {
                    dispatch(openCollectionSettings(result.id));
                  }
                  toast.success('Collection updated');
                } catch (err) {
                  alert(err instanceof Error ? err.message : 'Failed to update collection');
                }
              }}
              onCloseCollectionSettings={() => dispatch(closeOverlay())}
              environment={configuringEnvironment}
              onEnvironmentDirtyChange={(dirty) => dispatch(setEnvironmentSettingsDirty(dirty))}
              onEnvironmentSave={async (id, name, variables) => {
                try {
                  await dispatch(updateEnvironment({ id, name, variables })).unwrap();
                  toast.success('Environment updated');
                } catch (err) {
                  alert(err instanceof Error ? err.message : 'Failed to update environment');
                }
              }}
              onCloseEnvironmentSettings={() => dispatch(closeOverlay())}
            />
          ) : (
            <Request
              onEditVariables={() => {
                if (activeCollectionId == null) return;
                dispatch(openCollectionSettings(activeCollectionId));
              }}
            />
          )}
        </main>
      </div>

      <Footer
        consoleOpen={showConsole}
        entryCount={consoleEntries.length}
        onToggleConsole={() => dispatch(toggleConsole())}
        entries={consoleEntries}
        onClear={() => dispatch(clearConsole())}
        variablesOpen={showVariables}
        onToggleVariables={() => dispatch(toggleVariables())}
        collectionVariables={activeCollection?.variables ?? []}
        environmentVariables={activeEnvironment?.variables ?? []}
        collectionName={activeCollection?.name}
        environmentName={activeEnvironment?.name}
        sidebarOpen={sidebarVisible}
        onToggleSidebar={() => dispatch(toggleSidebar())}
      />

      <CollectionModal />
      <InviteModal />
      <UnsavedLoadPrompt />
      <QuitPrompt />
      <AboutModal />

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
