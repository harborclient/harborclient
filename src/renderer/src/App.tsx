import { BusyIndicator, CodeEditorConfigProvider } from '@harborclient/sdk/components';
import { useCallback, useEffect, useMemo, type JSX } from 'react';
import { Toaster } from 'react-hot-toast';
import type { Collection, Environment } from '#/shared/types';
import { useBeforeClose } from '#/renderer/src/hooks/useBeforeClose';
import { useEscapeBack } from '#/renderer/src/hooks/useEscapeBack';
import { useMenuActions } from '#/renderer/src/hooks/useMenuActions';
import { useDeepLinks } from '#/renderer/src/hooks/useDeepLinks';
import { useMcpServerStatus } from '#/renderer/src/hooks/useMcpServerStatus';
import { usePersistedPanelLayout } from '#/renderer/src/hooks/usePersistedPanelLayout';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActiveEnvironmentId,
  selectActivePage,
  selectActiveTabId,
  selectCollections,
  selectConsoleEntries,
  selectDraft,
  selectEnvironments,
  selectFoldersByCollection,
  selectRequestsByCollection,
  selectSelectedCollectionId
} from '#/renderer/src/store/selectors';
import { clearConsole } from '#/renderer/src/store/slices/consoleSlice';
import {
  selectAiSidebarVisible,
  selectShowConsole,
  selectShowMcp,
  selectShowRequestEditor,
  selectShowResponseEditor,
  selectShowVariables,
  selectSidebarVisible,
  toggleAiSidebar,
  toggleConsole,
  toggleMcp,
  toggleRequestEditor,
  toggleResponseEditor,
  toggleSidebar,
  toggleVariables
} from '#/renderer/src/store/slices/navigationSlice';
import {
  openCollectionModal,
  openShareModal,
  openThemePicker
} from '#/renderer/src/store/slices/modalsSlice';
import { closeTab, openPageTab } from '#/renderer/src/store/slices/tabsSlice';
import {
  initializeStore,
  loadTrustedKeys,
  refreshCollectionContents,
  requestLoadRequest
} from '#/renderer/src/store/thunks';
import { AboutModal } from '#/renderer/src/ui/modals/AboutModal';
import { SyncModal } from '#/renderer/src/ui/modals/SyncModal';
import { UpdateModal } from '#/renderer/src/ui/modals/UpdateModal';
import { AlertModal } from '#/renderer/src/ui/modals/AlertModal';
import { CollectionModal } from '#/renderer/src/ui/modals/CollectionModal';
import { ConfirmModal } from '#/renderer/src/ui/modals/ConfirmModal';
import { PluginModalOverlay } from '#/renderer/src/ui/PluginModalOverlay';
import { ShareModal } from '#/renderer/src/ui/modals/ShareModal';
import { QuitPrompt } from '#/renderer/src/ui/modals/QuitPrompt';
import { UnsavedLoadPrompt } from '#/renderer/src/ui/modals/UnsavedLoadPrompt';
import { AiSidebar } from '#/renderer/src/ui/AiSidebar';
import { Sidebar } from '#/renderer/src/ui/Sidebar';
import { SidebarExpansionProvider } from '#/renderer/src/ui/Sidebar/SidebarExpansionProvider';
import { RequestEditor } from '#/renderer/src/ui/Main/RequestEditor';
import { resolveVariableEditTarget } from '#/renderer/src/ui/Main/RequestEditor/resolveVariableEditTarget';
import { TitleBar } from '#/renderer/src/ui/TitleBar';
import { selectIsBusy } from '#/renderer/src/store/slices/uiSlice';
import {
  selectCodeEditorFontSize,
  selectCodeEditorSetup,
  selectCodeEditorTheme
} from '#/renderer/src/store/slices/settingsSlice';
import { Footer } from '#/renderer/src/ui/Footer';
import { FooterPanels } from '#/renderer/src/ui/Footer/FooterPanels';
import { AnimatedHorizontalPanel } from '#/renderer/src/ui/shared/AnimatedHorizontalPanel';
import {
  DEFAULT_TOAST_ARIA_PROPS,
  ERROR_TOAST_ARIA_PROPS,
  SUCCESS_TOAST_ARIA_PROPS
} from '#/renderer/src/ui/shared/toastA11y';
import { SearchIndexProvider } from '#/renderer/src/search/SearchIndexProvider';
import { PluginHost } from '#/renderer/src/plugins/PluginHost';
import { McpHost } from '#/renderer/src/store/ai/McpHost';
import { PluginThemePrompt } from '#/renderer/src/plugins/PluginThemePrompt';
import { ThemePickerModal } from '#/renderer/src/ui/modals/ThemePickerModal';
import { ShortcutsReferenceModal } from '#/renderer/src/ui/modals/ShortcutsReferenceModal';
import { SearchAnythingModal } from '#/renderer/src/ui/modals/SearchAnythingModal';
import { TeamHubJoinDeepLinkHost } from '#/renderer/src/ui/TeamHub/TeamHubJoinDeepLinkHost';
import { AcceptTeamHubInviteModal } from '#/renderer/src/ui/modals/AcceptTeamHubInviteModal';
import { applyThemeAttribute, subscribeContrastPreferenceChanges } from '#/renderer/src/theme';
import { platformClassName } from '#/renderer/src/platform';

/**
 * Root application layout: sidebar, request editor, and response viewer.
 */
export default function App(): JSX.Element {
  const dispatch = useAppDispatch();
  const isBusy = useAppSelector(selectIsBusy);
  const collections: Collection[] = useAppSelector(selectCollections);
  const environments: Environment[] = useAppSelector(selectEnvironments);
  const selectedCollectionId = useAppSelector(selectSelectedCollectionId);
  const activeEnvironmentId = useAppSelector(selectActiveEnvironmentId);
  const draft = useAppSelector(selectDraft);
  const consoleEntries = useAppSelector(selectConsoleEntries);
  const activePage = useAppSelector(selectActivePage);
  const activeTabId = useAppSelector(selectActiveTabId);
  const sidebarVisible = useAppSelector(selectSidebarVisible);
  const aiSidebarVisible = useAppSelector(selectAiSidebarVisible);
  const requestEditorVisible = useAppSelector(selectShowRequestEditor);
  const responseEditorVisible = useAppSelector(selectShowResponseEditor);
  const showConsole = useAppSelector(selectShowConsole);
  const showVariables = useAppSelector(selectShowVariables);
  const showMcp = useAppSelector(selectShowMcp);
  const mcpServerStatus = useMcpServerStatus();
  const foldersByCollection = useAppSelector(selectFoldersByCollection);
  const requestsByCollection = useAppSelector(selectRequestsByCollection);
  const globalVariables = useAppSelector((state) => state.settings.general.globalVariables);
  const codeEditorTheme = useAppSelector(selectCodeEditorTheme);
  const codeEditorSetup = useAppSelector(selectCodeEditorSetup);
  const codeEditorFontSize = useAppSelector(selectCodeEditorFontSize);

  useMenuActions();
  useDeepLinks();
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
   * Applies the high-contrast CSS override on launch and when the OS contrast
   * preference changes while the user keeps theme set to System.
   */
  useEffect(() => {
    let cancelled = false;

    /**
     * Loads the persisted theme and applies the matching root attribute.
     */
    const applyFromSettings = (): void => {
      void window.api.getTheme().then((theme) => {
        if (!cancelled) {
          applyThemeAttribute(theme);
        }
      });
    };

    applyFromSettings();
    const unsubscribeContrast = subscribeContrastPreferenceChanges(
      () => window.api.getTheme(),
      (theme) => {
        if (!cancelled) {
          applyThemeAttribute(theme);
        }
      }
    );

    return () => {
      cancelled = true;
      unsubscribeContrast();
    };
  }, []);

  /**
   * Opens the first-run theme picker when the user has not seen it or when
   * `--pick-theme` was passed on the command line.
   */
  useEffect(() => {
    let cancelled = false;

    void window.api.shouldPickTheme().then((shouldOpen) => {
      if (!cancelled && shouldOpen) {
        dispatch(openThemePicker());
      }
    });

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  /**
   * Opens the Getting Started tab once on first launch, then marks it seen.
   */
  useEffect(() => {
    let cancelled = false;

    void window.api.shouldOpenGettingStarted().then((shouldOpen) => {
      if (cancelled || !shouldOpen) {
        return;
      }

      dispatch(openPageTab({ type: 'getting-started' }));
      void window.api.markGettingStartedSeen();
    });

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  const activeCollectionId = draft.collection_id ?? selectedCollectionId;

  /**
   * Loads folders and requests for the active collection when that data has not
   * been fetched yet (lazy load on mount or collection change).
   */
  useEffect(() => {
    if (activeCollectionId == null) return;
    if (!collections.some((collection) => collection.id === activeCollectionId)) return;
    if (foldersByCollection[activeCollectionId] === undefined) {
      void dispatch(refreshCollectionContents(activeCollectionId));
    }
  }, [activeCollectionId, collections, foldersByCollection, dispatch]);

  const activeCollection =
    activeCollectionId != null
      ? collections.find((c: Collection) => c.id === activeCollectionId)
      : undefined;
  const activeEnvironment =
    activeEnvironmentId != null
      ? environments.find((env: Environment) => env.id === activeEnvironmentId)
      : undefined;

  const activeFolderId = useMemo(() => {
    if (activeCollectionId == null) return null;
    if (draft.id != null) {
      const saved = (requestsByCollection[activeCollectionId] ?? []).find(
        (request) => request.id === draft.id
      );
      if (saved) return saved.folder_id;
    }
    return draft.folder_id ?? null;
  }, [activeCollectionId, draft.folder_id, draft.id, requestsByCollection]);

  const activeFolder = useMemo(() => {
    if (activeCollectionId == null || activeFolderId == null) return undefined;
    return (foldersByCollection[activeCollectionId] ?? []).find(
      (folder) => folder.id === activeFolderId
    );
  }, [activeCollectionId, activeFolderId, foldersByCollection]);

  /**
   * Closes the active page tab on Escape.
   */
  useEscapeBack(() => {
    if (activeTabId) {
      dispatch(closeTab(activeTabId));
    }
  }, activePage != null);

  return (
    <CodeEditorConfigProvider
      value={{ theme: codeEditorTheme, setup: codeEditorSetup, fontSize: codeEditorFontSize }}
    >
      <SidebarExpansionProvider onExpandCollection={handleExpandCollection}>
        <SearchIndexProvider>
          <PluginHost />
          <McpHost />
          <PluginThemePrompt />
          <div className={`flex h-screen flex-col overflow-hidden ${platformClassName()}`}>
            <BusyIndicator isBusy={isBusy} />
            <TitleBar />
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[100] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-[14px] focus:text-text focus:shadow-md focus:outline focus:outline-2 focus:outline-accent"
            >
              Skip to main content
            </a>
            <div className="relative flex min-h-0 flex-1 overflow-hidden">
              <AnimatedHorizontalPanel open={sidebarVisible}>
                <Sidebar
                  onAddCollection={() => dispatch(openCollectionModal({ mode: 'create' }))}
                  onConfigureCollection={(id) => dispatch(openPageTab({ type: 'collection', id }))}
                  onConfigureFolder={(collectionId, folderId) =>
                    dispatch(openPageTab({ type: 'folder', collectionId, id: folderId }))
                  }
                  onConfigureEnvironment={(id) =>
                    dispatch(openPageTab({ type: 'environment', id }))
                  }
                  onShareCollection={(collectionId, collectionName) => {
                    dispatch(openShareModal({ collectionId, collectionName }));
                    void dispatch(loadTrustedKeys());
                  }}
                  onLoadRequest={(req) => void dispatch(requestLoadRequest({ req }))}
                />
              </AnimatedHorizontalPanel>

              <main
                id="main-content"
                tabIndex={-1}
                className="relative flex min-w-0 flex-1 flex-col bg-surface"
              >
                <RequestEditor
                  onEditVariables={(key) => {
                    const target = resolveVariableEditTarget({
                      key,
                      globalVariables,
                      collectionVariables: activeCollection?.variables ?? [],
                      folderVariables: activeFolder?.variables ?? [],
                      environmentVariables: activeEnvironment?.variables ?? [],
                      activeCollectionId,
                      activeFolderId,
                      activeEnvironmentId
                    });
                    if (target == null) return;

                    if (target.scope === 'environment' && target.environmentId != null) {
                      dispatch(
                        openPageTab({
                          type: 'environment',
                          id: target.environmentId,
                          focusVariableKey: key
                        })
                      );
                      return;
                    }

                    if (target.scope === 'folder' && target.folderId != null) {
                      dispatch(
                        openPageTab({
                          type: 'folder',
                          collectionId: target.collectionId ?? activeCollectionId ?? 0,
                          id: target.folderId,
                          focusVariableKey: key
                        })
                      );
                      return;
                    }

                    if (target.scope === 'collection' && target.collectionId != null) {
                      dispatch(
                        openPageTab({
                          type: 'collection',
                          id: target.collectionId,
                          focusVariableKey: key
                        })
                      );
                      return;
                    }

                    dispatch(
                      openPageTab({
                        type: 'settings',
                        section: 'globals',
                        focusVariableKey: key
                      })
                    );
                  }}
                />
                <FooterPanels
                  consoleOpen={showConsole}
                  onToggleConsole={() => dispatch(toggleConsole())}
                  entries={consoleEntries}
                  onClear={() => dispatch(clearConsole())}
                  variablesOpen={showVariables}
                  onToggleVariables={() => dispatch(toggleVariables())}
                  mcpOpen={showMcp}
                  onToggleMcp={() => dispatch(toggleMcp())}
                  onMcpStatusChange={() => void mcpServerStatus.refresh()}
                  globalVariables={globalVariables}
                  collectionVariables={activeCollection?.variables ?? []}
                  folderVariables={activeFolder?.variables ?? []}
                  environmentVariables={activeEnvironment?.variables ?? []}
                  collectionName={activeCollection?.name}
                  folderName={activeFolder?.name}
                  environmentName={activeEnvironment?.name}
                />
              </main>

              <AnimatedHorizontalPanel open={aiSidebarVisible}>
                <AiSidebar />
              </AnimatedHorizontalPanel>
            </div>

            <Footer
              consoleOpen={showConsole}
              entryCount={consoleEntries.length}
              onToggleConsole={() => dispatch(toggleConsole())}
              variablesOpen={showVariables}
              onToggleVariables={() => dispatch(toggleVariables())}
              mcpOpen={showMcp}
              onToggleMcp={() => dispatch(toggleMcp())}
              mcpServerRunning={mcpServerStatus.running}
              globalVariables={globalVariables}
              collectionVariables={activeCollection?.variables ?? []}
              folderVariables={activeFolder?.variables ?? []}
              environmentVariables={activeEnvironment?.variables ?? []}
              sidebarOpen={sidebarVisible}
              onToggleSidebar={() => dispatch(toggleSidebar())}
              aiSidebarOpen={aiSidebarVisible}
              onToggleAiSidebar={() => dispatch(toggleAiSidebar())}
              requestEditorOpen={requestEditorVisible}
              onToggleRequestEditor={() => dispatch(toggleRequestEditor())}
              responseEditorOpen={responseEditorVisible}
              onToggleResponseEditor={() => dispatch(toggleResponseEditor())}
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
            <ThemePickerModal />
            <ShortcutsReferenceModal />
            <SearchAnythingModal />
            <PluginModalOverlay />
            <AcceptTeamHubInviteModal />
            <TeamHubJoinDeepLinkHost />

            <Toaster
              position="bottom-center"
              containerStyle={{ bottom: 16 }}
              toastOptions={{
                duration: 2000,
                ariaProps: DEFAULT_TOAST_ARIA_PROPS,
                success: {
                  ariaProps: SUCCESS_TOAST_ARIA_PROPS
                },
                error: {
                  ariaProps: ERROR_TOAST_ARIA_PROPS
                },
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
        </SearchIndexProvider>
      </SidebarExpansionProvider>
    </CodeEditorConfigProvider>
  );
}
