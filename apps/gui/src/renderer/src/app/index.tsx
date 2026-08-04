import { BusyIndicator, CodeEditorConfigProvider } from '@harborclient/sdk/components';
import { useCallback, useEffect, useMemo, type JSX } from 'react';
import type { Collection } from '@harborclient/core/types';
import { useBeforeClose } from '#/renderer/src/hooks/useBeforeClose';
import { useEscapeBack } from '#/renderer/src/hooks/useEscapeBack';
import { useMenuActions } from '#/renderer/src/hooks/useMenuActions';
import { useDeepLinks } from '#/renderer/src/hooks/useDeepLinks';
import { usePersistedPanelLayout } from '#/renderer/src/hooks/usePersistedPanelLayout';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActivePage,
  selectActiveTab,
  selectActiveTabId,
  selectCollections,
  selectDraft,
  selectFoldersByCollection,
  selectSelectedCollectionId
} from '#/renderer/src/store/selectors';
import { isRequestTab } from '#/renderer/src/store/tabs';
import {
  selectAiSidebarVisible,
  selectGitSidebarVisible,
  selectShortcutsSidebarVisible,
  selectLiveServerLogsSidebarOpen,
  selectShowRequestEditor,
  selectShowResponseEditor,
  selectSidebarVisible,
  toggleShortcutsSidebar
} from '#/renderer/src/store/slices/navigationSlice';
import { openThemePicker } from '#/renderer/src/store/slices/modalsSlice';
import { closeTab, openPageTab } from '#/renderer/src/store/slices/tabsSlice';
import {
  bootstrapShellForReveal,
  refreshCollectionContents,
  startBackgroundRefresh,
  waitForPaint
} from '#/renderer/src/store/thunks';
import { SaveRequestModal } from '#/renderer/src/ui/Modals/SaveRequestModal';
import { AiSidebar } from '#/renderer/src/ui/Sidebars/AiSidebar';
import { GitSidebar } from '#/renderer/src/ui/Sidebars/GitSidebar';
import { LiveServerLogsSidebar } from '#/renderer/src/ui/Sidebars/LiveServerLogsSidebar';
import { ShortcutsSidebar } from '#/renderer/src/ui/Sidebars/ShortcutsSidebar';
import { CollectionSidebar } from '#/renderer/src/ui/Sidebars/CollectionSidebar';
import { SidebarGitProvider } from '#/renderer/src/ui/Sidebars/CollectionSidebar/git/SidebarGitProvider';
import { SidebarExpansionProvider } from '#/renderer/src/ui/Sidebars/CollectionSidebar/expansion/SidebarExpansionProvider';
import { FileMenuEnvironmentHost } from '#/renderer/src/ui/Sidebars/CollectionSidebar/modals/FileMenuEnvironmentHost';
import { SidebarModalsProvider } from '#/renderer/src/ui/Sidebars/CollectionSidebar/modals/SidebarModals';
import { RequestEditor } from '#/renderer/src/ui/Main/RequestEditor';
import { TitleBar } from '#/renderer/src/ui/TitleBar';
import { selectIsBusy } from '#/renderer/src/store/slices/uiSlice';
import {
  selectCodeEditorFontSize,
  selectCodeEditorSetup,
  selectCodeEditorTheme
} from '#/renderer/src/store/slices/settingsSlice';
import { Footer } from '#/renderer/src/ui/Footer';
import { FooterPanels } from '#/renderer/src/ui/Footer/FooterPanels';
import { useBrowserGuestOverlayCover } from '#/renderer/src/ui/Main/RequestEditor/BrowserTab/useBrowserGuestOverlayCover';
import { AnimatedHorizontalPanel } from '#/renderer/src/ui/Shared/Animated/AnimatedHorizontalPanel';
import { SkipNavigation } from '#/renderer/src/ui/Shared/SkipNavigation/SkipNavigation';
import {
  AI_SIDEBAR_SECTION_ID,
  COLLECTIONS_SIDEBAR_SECTION_ID,
  GIT_SIDEBAR_SECTION_ID,
  LIVE_SERVER_LOGS_SIDEBAR_SECTION_ID,
  SHORTCUTS_SIDEBAR_SECTION_ID,
  type SkipNavigationVisibility
} from '#/renderer/src/ui/Shared/SkipNavigation/skipNavigationTargets';
import { SearchIndexProvider } from '#/renderer/src/search/SearchIndexProvider';
import {
  subscribeColorSchemePreferenceChanges,
  subscribeContrastPreferenceChanges
} from '../theme';
import { applyThemePreference } from '#/renderer/src/plugins/themeRuntime';
import { platformClassName } from '../platform';
import { Hosts } from './Hosts';
import { Modals } from './Modals';
/**
 * Root application layout: sidebar, request editor, and response viewer.
 */
export default function App(): JSX.Element {
  const dispatch = useAppDispatch();
  const isBusy = useAppSelector(selectIsBusy);
  const collections: Collection[] = useAppSelector(selectCollections);
  const selectedCollectionId = useAppSelector(selectSelectedCollectionId);
  const draft = useAppSelector(selectDraft);
  const activePage = useAppSelector(selectActivePage);
  const activeTab = useAppSelector(selectActiveTab);
  const activeTabId = useAppSelector(selectActiveTabId);
  const sidebarVisible = useAppSelector(selectSidebarVisible);
  const aiSidebarVisible = useAppSelector(selectAiSidebarVisible);
  const gitSidebarVisible = useAppSelector(selectGitSidebarVisible);
  const shortcutsSidebarVisible = useAppSelector(selectShortcutsSidebarVisible);
  const requestEditorVisible = useAppSelector(selectShowRequestEditor);
  const responseEditorVisible = useAppSelector(selectShowResponseEditor);
  const liveServerLogsSidebarOpen = useAppSelector(selectLiveServerLogsSidebarOpen);
  const foldersByCollection = useAppSelector(selectFoldersByCollection);
  const codeEditorTheme = useAppSelector(selectCodeEditorTheme);
  const codeEditorSetup = useAppSelector(selectCodeEditorSetup);
  const codeEditorFontSize = useAppSelector(selectCodeEditorFontSize);

  useMenuActions();
  useDeepLinks();
  usePersistedPanelLayout();
  useBeforeClose();
  useBrowserGuestOverlayCover();

  /**
   * Loads folders and requests when a collection tree is expanded in the sidebar,
   * skipping collections whose contents were already hydrated during shell bootstrap.
   */
  const handleExpandCollection = useCallback(
    (id: number) => {
      if (foldersByCollection[id] !== undefined) {
        return;
      }
      void dispatch(refreshCollectionContents(id));
    },
    [dispatch, foldersByCollection]
  );

  /**
   * Bootstraps shell data while the splash is visible, then reveals the main window.
   */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await dispatch(bootstrapShellForReveal());
      if (cancelled) return;
      await waitForPaint();
      if (cancelled) return;
      await window.api.notifyUiReady();
      if (cancelled) return;
      startBackgroundRefresh(dispatch);
    })();

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  /**
   * Applies the persisted theme palette on launch and when OS appearance
   * preferences change while the user keeps theme set to System.
   */
  useEffect(() => {
    let cancelled = false;

    /**
     * Loads the persisted theme and applies the matching palette.
     */
    const applyFromSettings = (): void => {
      void window.api.getTheme().then((theme) => {
        if (!cancelled) {
          void applyThemePreference(theme);
        }
      });
    };

    applyFromSettings();
    const unsubscribeContrast = subscribeContrastPreferenceChanges(
      () => window.api.getTheme(),
      (theme) => {
        if (!cancelled && theme === 'system') {
          void applyThemePreference(theme);
        }
      }
    );
    const unsubscribeColorScheme = subscribeColorSchemePreferenceChanges(
      () => window.api.getTheme(),
      () => {
        if (!cancelled) {
          void window.api.getTheme().then((theme) => {
            if (theme === 'system') {
              void applyThemePreference(theme);
            }
          });
        }
      }
    );

    return () => {
      cancelled = true;
      unsubscribeContrast();
      unsubscribeColorScheme();
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
   * been fetched yet (for example after switching collections post-bootstrap).
   * Shell bootstrap already hydrates the initial active collection before reveal.
   */
  useEffect(() => {
    if (activeCollectionId == null) return;
    if (!collections.some((collection) => collection.id === activeCollectionId)) return;
    if (foldersByCollection[activeCollectionId] === undefined) {
      void dispatch(refreshCollectionContents(activeCollectionId));
    }
  }, [activeCollectionId, collections, foldersByCollection, dispatch]);

  /**
   * Closes the active page tab on Escape.
   */
  useEscapeBack(() => {
    if (activeTabId) {
      dispatch(closeTab(activeTabId));
    }
  }, activePage != null);

  /**
   * Resolves skip-link visibility from the current panel layout and active tab type.
   */
  const skipNavigationVisibility = useMemo((): SkipNavigationVisibility => {
    return {
      sidebarVisible,
      requestEditorVisible,
      responseEditorVisible,
      aiSidebarVisible,
      gitSidebarVisible,
      shortcutsSidebarVisible,
      liveServerLogsSidebarVisible: liveServerLogsSidebarOpen,
      isRequestTab: activeTab != null && isRequestTab(activeTab)
    };
  }, [
    activeTab,
    aiSidebarVisible,
    gitSidebarVisible,
    liveServerLogsSidebarOpen,
    shortcutsSidebarVisible,
    requestEditorVisible,
    responseEditorVisible,
    sidebarVisible
  ]);

  return (
    <CodeEditorConfigProvider
      value={{ theme: codeEditorTheme, setup: codeEditorSetup, fontSize: codeEditorFontSize }}
    >
      <SidebarExpansionProvider onExpandCollection={handleExpandCollection}>
        <SidebarGitProvider>
          <SearchIndexProvider>
            <div className={`flex h-screen flex-col overflow-hidden ${platformClassName()}`}>
              {/* Head */}
              <BusyIndicator isBusy={isBusy} />
              <SkipNavigation
                visibility={skipNavigationVisibility}
                onOpenShortcuts={() => dispatch(toggleShortcutsSidebar())}
              />
              <TitleBar />

              {/* Main UI */}
              <SidebarModalsProvider>
                <FileMenuEnvironmentHost />
                <div className="relative flex min-h-0 flex-1 overflow-hidden">
                  {/* Left sidebar */}
                  <AnimatedHorizontalPanel
                    id={COLLECTIONS_SIDEBAR_SECTION_ID}
                    tabIndex={-1}
                    open={sidebarVisible}
                  >
                    <CollectionSidebar />
                  </AnimatedHorizontalPanel>

                  {/* Request editor */}
                  <main
                    id="main-content"
                    tabIndex={-1}
                    className="relative flex min-w-0 flex-1 flex-col bg-surface"
                  >
                    <RequestEditor />
                    <FooterPanels />
                  </main>

                  {/* Right sidebar */}
                  <AnimatedHorizontalPanel
                    id={GIT_SIDEBAR_SECTION_ID}
                    tabIndex={-1}
                    open={gitSidebarVisible}
                  >
                    <GitSidebar />
                  </AnimatedHorizontalPanel>

                  <AnimatedHorizontalPanel
                    id={AI_SIDEBAR_SECTION_ID}
                    tabIndex={-1}
                    open={aiSidebarVisible}
                  >
                    <AiSidebar />
                  </AnimatedHorizontalPanel>

                  <AnimatedHorizontalPanel
                    id={SHORTCUTS_SIDEBAR_SECTION_ID}
                    tabIndex={-1}
                    open={shortcutsSidebarVisible}
                  >
                    <ShortcutsSidebar />
                  </AnimatedHorizontalPanel>

                  <AnimatedHorizontalPanel
                    id={LIVE_SERVER_LOGS_SIDEBAR_SECTION_ID}
                    tabIndex={-1}
                    open={liveServerLogsSidebarOpen}
                  >
                    {liveServerLogsSidebarOpen ? <LiveServerLogsSidebar /> : null}
                  </AnimatedHorizontalPanel>
                </div>
                <SaveRequestModal />
              </SidebarModalsProvider>

              <Footer />
              <Modals />
              <Hosts />
            </div>
          </SearchIndexProvider>
        </SidebarGitProvider>
      </SidebarExpansionProvider>
    </CodeEditorConfigProvider>
  );
}
