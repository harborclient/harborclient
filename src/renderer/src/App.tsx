import { useCallback, useEffect, type JSX } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import type { Collection, Environment } from '#/shared/types';
import { useBeforeClose } from '#/renderer/src/hooks/useBeforeClose';
import { useMenuActions } from '#/renderer/src/hooks/useMenuActions';
import { usePersistedPanelLayout } from '#/renderer/src/hooks/usePersistedPanelLayout';
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
  selectAiSidebarVisible,
  selectMainView,
  selectSettingsSection,
  selectShowConsole,
  selectShowVariables,
  selectSidebarVisible,
  setCollectionSettingsDirty,
  setEnvironmentSettingsDirty,
  toggleAiSidebar,
  toggleConsole,
  toggleSidebar,
  toggleVariables
} from '#/renderer/src/store/slices/navigationSlice';
import { openCollectionModal, openShareModal } from '#/renderer/src/store/slices/modalsSlice';
import {
  initializeStore,
  loadTrustedKeys,
  refreshCollectionContents,
  requestLoadRequest,
  updateCollection,
  updateEnvironment
} from '#/renderer/src/store/thunks';
import { AboutModal } from '#/renderer/src/ui/modals/AboutModal';
import { SyncModal } from '#/renderer/src/ui/modals/SyncModal';
import { UpdateModal } from '#/renderer/src/ui/modals/UpdateModal';
import { AlertModal } from '#/renderer/src/ui/modals/AlertModal';
import { CollectionModal } from '#/renderer/src/ui/modals/CollectionModal';
import { ConfirmModal } from '#/renderer/src/ui/modals/ConfirmModal';
import { ShareModal } from '#/renderer/src/ui/modals/ShareModal';
import { QuitPrompt } from '#/renderer/src/ui/modals/QuitPrompt';
import { UnsavedLoadPrompt } from '#/renderer/src/ui/modals/UnsavedLoadPrompt';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/modals/dialogHelpers';
import { AiSidebar } from '#/renderer/src/ui/AiSidebar';
import { Configuration } from '#/renderer/src/ui/Configuration';
import { Sidebar } from '#/renderer/src/ui/Sidebar';
import { SidebarExpansionProvider } from '#/renderer/src/ui/Sidebar/SidebarExpansionProvider';
import { Request } from '#/renderer/src/ui/Request';
import { TitleBar } from '#/renderer/src/ui/TitleBar';
import { BusyIndicator } from '#/renderer/src/ui/shared/BusyIndicator';
import { Footer } from '#/renderer/src/ui/Footer';
import { PluginHost } from '#/renderer/src/plugins/PluginHost';
import { applyThemeAttribute } from '#/renderer/src/theme';
import { platformClassName } from '#/renderer/src/platform';

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
  const settingsSection = useAppSelector(selectSettingsSection);
  const sidebarVisible = useAppSelector(selectSidebarVisible);
  const aiSidebarVisible = useAppSelector(selectAiSidebarVisible);
  const showConsole = useAppSelector(selectShowConsole);
  const showVariables = useAppSelector(selectShowVariables);
  const foldersByCollection = useAppSelector(selectFoldersByCollection);

  useMenuActions();
  usePersistedPanelLayout();
  useBeforeClose();

  /**
   * Loads folders and requests when a collection tree is expanded in the sidebar.
   */
  const handleExpandCollection = useCallback(
    (id: number) => {
      void dispatch(refreshCollectionContents(id));
    },
    [dispatch]
  );

  /**
   * Initializes the store.
   */
  useEffect(() => {
    initializeStore(dispatch);
  }, [dispatch]);

  /**
   * Applies the persisted high-contrast CSS override on launch.
   */
  useEffect(() => {
    let cancelled = false;
    window.api.getTheme().then((theme) => {
      if (!cancelled) {
        applyThemeAttribute(theme);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
    mainView.type === 'team-hubs' ||
    mainView.type === 'sharing-keys' ||
    mainView.type === 'plugin-view' ||
    configuringCollection != null ||
    configuringEnvironment != null;

  return (
    <SidebarExpansionProvider onExpandCollection={handleExpandCollection}>
      <PluginHost />
      <div className={`flex h-screen flex-col overflow-hidden ${platformClassName()}`}>
        <BusyIndicator />
        <TitleBar />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[100] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-[14px] focus:text-text focus:shadow-md focus:outline focus:outline-2 focus:outline-accent"
        >
          Skip to main content
        </a>
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          {sidebarVisible && (
            <Sidebar
              onAddCollection={() => dispatch(openCollectionModal({ mode: 'create' }))}
              onConfigureCollection={(id) => dispatch(openCollectionSettings(id))}
              onConfigureEnvironment={(id) => dispatch(openEnvironmentSettings(id))}
              onShareCollection={(collectionId, collectionName) => {
                dispatch(openShareModal({ collectionId, collectionName }));
                void dispatch(loadTrustedKeys());
              }}
              onLoadRequest={(req) => void dispatch(requestLoadRequest({ req }))}
            />
          )}

          <main id="main-content" tabIndex={-1} className="flex min-w-0 flex-1 flex-col bg-surface">
            {showConfiguration ? (
              <Configuration
                showSettings={mainView.type === 'settings'}
                onCloseAppSettings={() => dispatch(closeOverlay())}
                settingsSection={settingsSection}
                showSharingKeys={mainView.type === 'sharing-keys'}
                onCloseSharingKeys={() => dispatch(closeOverlay())}
                showTeamHubs={mainView.type === 'team-hubs'}
                onCloseTeamHubs={() => dispatch(closeOverlay())}
                showPluginView={mainView.type === 'plugin-view'}
                pluginViewPluginId={mainView.type === 'plugin-view' ? mainView.pluginId : undefined}
                pluginViewId={mainView.type === 'plugin-view' ? mainView.viewId : undefined}
                onClosePluginView={() => dispatch(closeOverlay())}
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
                    showAlert(dispatch, formatErrorMessage(err, 'Failed to update collection'));
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
                    showAlert(dispatch, formatErrorMessage(err, 'Failed to update environment'));
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

          {aiSidebarVisible && <AiSidebar />}
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
          aiSidebarOpen={aiSidebarVisible}
          onToggleAiSidebar={() => dispatch(toggleAiSidebar())}
        />

        <CollectionModal />
        <ShareModal />
        <UnsavedLoadPrompt />
        <QuitPrompt />
        <AboutModal />
        <UpdateModal />
        <SyncModal />
        <AlertModal />
        <ConfirmModal />

        <Toaster
          position="bottom-center"
          containerStyle={{ bottom: 16 }}
          toastOptions={{
            duration: 2000,
            style: {
              background: 'var(--mac-control)',
              color: 'var(--mac-text)',
              border: '1px solid var(--mac-separator)',
              fontSize: '14px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }
          }}
        />
      </div>
    </SidebarExpansionProvider>
  );
}
