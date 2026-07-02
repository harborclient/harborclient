import { BusyIndicator, CodeEditorConfigProvider } from '@harborclient/sdk/components';
import { useCallback, useEffect, type JSX } from 'react';
import { Toaster } from 'react-hot-toast';
import type { Collection, Environment } from '#/shared/types';
import { useBeforeClose } from '#/renderer/src/hooks/useBeforeClose';
import { useEscapeBack } from '#/renderer/src/hooks/useEscapeBack';
import { useMenuActions } from '#/renderer/src/hooks/useMenuActions';
import { useDeepLinks } from '#/renderer/src/hooks/useDeepLinks';
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
  selectSelectedCollectionId
} from '#/renderer/src/store/selectors';
import { clearConsole } from '#/renderer/src/store/slices/consoleSlice';
import {
  selectAiSidebarVisible,
  selectShowConsole,
  selectShowRequestEditor,
  selectShowResponseEditor,
  selectShowVariables,
  selectSidebarVisible,
  toggleAiSidebar,
  toggleConsole,
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
import { CollectionRunnerModal } from '#/renderer/src/ui/modals/CollectionRunnerModal';
import { QuitPrompt } from '#/renderer/src/ui/modals/QuitPrompt';
import { UnsavedLoadPrompt } from '#/renderer/src/ui/modals/UnsavedLoadPrompt';
import { AiSidebar } from '#/renderer/src/ui/AiSidebar';
import { Sidebar } from '#/renderer/src/ui/Sidebar';
import { SidebarExpansionProvider } from '#/renderer/src/ui/Sidebar/SidebarExpansionProvider';
import { RequestEditor } from '#/renderer/src/ui/Main/RequestEditor';
import { TitleBar } from '#/renderer/src/ui/TitleBar';
import { selectIsBusy } from '#/renderer/src/store/slices/uiSlice';
import {
  selectCodeEditorSetup,
  selectCodeEditorTheme
} from '#/renderer/src/store/slices/settingsSlice';
import { Footer } from '#/renderer/src/ui/Footer';
import {
  DEFAULT_TOAST_ARIA_PROPS,
  ERROR_TOAST_ARIA_PROPS,
  SUCCESS_TOAST_ARIA_PROPS
} from '#/renderer/src/ui/shared/toastA11y';
import { PluginHost } from '#/renderer/src/plugins/PluginHost';
import { PluginThemePrompt } from '#/renderer/src/plugins/PluginThemePrompt';
import { ThemePickerModal } from '#/renderer/src/ui/modals/ThemePickerModal';
import { ShortcutsReferenceModal } from '#/renderer/src/ui/modals/ShortcutsReferenceModal';
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
  const foldersByCollection = useAppSelector(selectFoldersByCollection);
  const globalVariables = useAppSelector((state) => state.settings.general.globalVariables);
  const codeEditorTheme = useAppSelector(selectCodeEditorTheme);
  const codeEditorSetup = useAppSelector(selectCodeEditorSetup);

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

  /**
   * Closes the active page tab on Escape; Team Hub manages its own nested stack.
   */
  useEscapeBack(
    () => {
      if (activeTabId) {
        dispatch(closeTab(activeTabId));
      }
    },
    activePage != null && activePage.type !== 'team-hubs'
  );

  return (
    <CodeEditorConfigProvider value={{ theme: codeEditorTheme, setup: codeEditorSetup }}>
      <SidebarExpansionProvider onExpandCollection={handleExpandCollection}>
        <PluginHost />
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
            {sidebarVisible && (
              <Sidebar
                onAddCollection={() => dispatch(openCollectionModal({ mode: 'create' }))}
                onConfigureCollection={(id) => dispatch(openPageTab({ type: 'collection', id }))}
                onConfigureEnvironment={(id) => dispatch(openPageTab({ type: 'environment', id }))}
                onShareCollection={(collectionId, collectionName) => {
                  dispatch(openShareModal({ collectionId, collectionName }));
                  void dispatch(loadTrustedKeys());
                }}
                onLoadRequest={(req) => void dispatch(requestLoadRequest({ req }))}
              />
            )}

            <main
              id="main-content"
              tabIndex={-1}
              className="flex min-w-0 flex-1 flex-col bg-surface"
            >
              <RequestEditor
                onEditVariables={() => {
                  if (activeCollectionId == null) return;
                  dispatch(openPageTab({ type: 'collection', id: activeCollectionId }));
                }}
              />
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
            globalVariables={globalVariables}
            collectionVariables={activeCollection?.variables ?? []}
            environmentVariables={activeEnvironment?.variables ?? []}
            collectionName={activeCollection?.name}
            environmentName={activeEnvironment?.name}
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
          <CollectionRunnerModal />
          <AlertModal />
          <ConfirmModal />
          <ThemePickerModal />
          <ShortcutsReferenceModal />
          <PluginModalOverlay />

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
      </SidebarExpansionProvider>
    </CodeEditorConfigProvider>
  );
}
