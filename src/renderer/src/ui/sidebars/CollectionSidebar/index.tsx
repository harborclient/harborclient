import { ControlledAccordion } from '@szhsin/react-accordion';
import { Scrollbars } from '#/renderer/src/components/Scrollbars';
import { useMemo, type JSX } from 'react';
import { PluginSurface } from '#/renderer/src/plugins/PluginSurface';
import {
  usePluginSidebarPanels,
  usePluginSidebarSections
} from '#/renderer/src/plugins/pluginHooks';
import {
  faSquareMinus,
  faClockRotateLeft,
  faCloud,
  faFolder,
  faSun
} from '#/renderer/src/fontawesome';
import {
  ResizeHandle,
  Toolbar,
  useResizable,
  type ToolbarAction
} from '@harborclient/sdk/components';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActiveEnvironmentId,
  selectSelectedCollectionId
} from '#/renderer/src/store/selectors';
import { selectActiveSidebarPanelId } from '#/renderer/src/store/slices/navigationSlice';
import { openCollectionModal } from '#/renderer/src/store/slices/modalsSlice';
import { Collections } from './Collections';
import { Environments } from './Environments';
import { RunResults } from './RunResults';
import { Section } from './Section';
import { SidebarSearch } from './SidebarSearch';
import { SidebarPanelSwitcher } from './SidebarPanelSwitcher';
import { SidebarProvidersProvider } from './SidebarProvidersProvider';
import { SidebarGitProvider } from './SidebarGitProvider';
import { SidebarSearchProvider } from './SidebarSearchProvider';
import { useSidebarSearchContext } from './sidebarSearchContext';
import { SidebarModalsProvider } from './SidebarModals';
import { useSidebarModals } from './sidebarModalsContext';
import { useSidebarExpansion } from './useSidebarExpansion';
import { useSidebarListNavigation } from './useSidebarListNavigation';
import { useSidebarAccordion } from './useSidebarAccordion';

/**
 * Inner sidebar body rendered inside the sidebar context providers. Composes
 * the panel switcher, search field, section toolbar, and the collapsible
 * Collections/Environments/Run Results sections. Sections source their own
 * data and actions, so this shell only wires layout and shared UI state.
 */
function SidebarContent(): JSX.Element {
  const dispatch = useAppDispatch();
  const selectedCollectionId = useAppSelector(selectSelectedCollectionId);
  const activeEnvironmentId = useAppSelector(selectActiveEnvironmentId);
  const activeSidebarPanelId = useAppSelector(selectActiveSidebarPanelId);
  const pluginSidebarPanels = usePluginSidebarPanels();
  const pluginSidebarSections = usePluginSidebarSections();

  const {
    collectionsSectionExpanded,
    environmentsSectionExpanded,
    runResultsSectionExpanded,
    collectionsSectionVisible,
    environmentsSectionVisible,
    runResultsSectionVisible,
    showStorageLocationBadges,
    toggleStorageLocationBadges,
    toggleCollectionsSectionVisible,
    toggleEnvironmentsSectionVisible,
    toggleRunResultsSectionVisible
  } = useSidebarExpansion();

  const { searchQuery, setSearchQuery, searchLoading, collapseAllSidebarTrees } =
    useSidebarSearchContext();
  const { openAddEnvironment } = useSidebarModals();
  const { accordion, pluginSectionExpanded } = useSidebarAccordion();

  useSidebarListNavigation(selectedCollectionId, activeEnvironmentId);

  const {
    size: width,
    minSize: sidebarMinSize,
    maxSize: sidebarMaxSize,
    onResizeStart,
    onKeyboardResize
  } = useResizable({
    axis: 'x',
    direction: 1,
    defaultSize: 400,
    minSize: 240,
    getMaxSize: () => 640,
    storageKey: 'hc.sidebarWidth'
  });

  /**
   * Resolves the active switchable sidebar panel contribution, if any.
   */
  const activeSidebarPanel = useMemo(
    () => pluginSidebarPanels.find((panel) => panel.id === activeSidebarPanelId) ?? null,
    [pluginSidebarPanels, activeSidebarPanelId]
  );

  /**
   * Toolbar actions for section visibility and storage badges.
   */
  const toolbarActions = useMemo((): ToolbarAction[] => {
    return [
      {
        id: 'toggle-collections-section',
        icon: faFolder,
        label: 'Collections',
        title: collectionsSectionVisible ? 'Hide collections section' : 'Show collections section',
        ariaPressed: collectionsSectionVisible,
        onClick: toggleCollectionsSectionVisible
      },
      {
        id: 'toggle-environments-section',
        icon: faSun,
        label: 'Environments',
        title: environmentsSectionVisible
          ? 'Hide environments section'
          : 'Show environments section',
        ariaPressed: environmentsSectionVisible,
        onClick: toggleEnvironmentsSectionVisible
      },
      {
        id: 'toggle-run-results-section',
        icon: faClockRotateLeft,
        label: 'Run results',
        title: runResultsSectionVisible ? 'Hide run results section' : 'Show run results section',
        ariaPressed: runResultsSectionVisible,
        onClick: toggleRunResultsSectionVisible
      },
      {
        id: 'toggle-storage-badges',
        icon: faCloud,
        label: 'Storage location badges',
        title: showStorageLocationBadges
          ? 'Hide storage location badges'
          : 'Show storage location badges',
        ariaPressed: showStorageLocationBadges,
        onClick: toggleStorageLocationBadges
      }
    ];
  }, [
    collectionsSectionVisible,
    environmentsSectionVisible,
    runResultsSectionVisible,
    toggleCollectionsSectionVisible,
    toggleEnvironmentsSectionVisible,
    toggleRunResultsSectionVisible,
    showStorageLocationBadges,
    toggleStorageLocationBadges
  ]);

  /**
   * Right-aligned toolbar toggles such as collapse-all.
   */
  const toolbarToggles = useMemo((): ToolbarAction[] => {
    return [
      {
        id: 'collapse-all',
        icon: faSquareMinus,
        label: 'Collapse all',
        title: 'Collapse all collections and folders',
        onClick: collapseAllSidebarTrees
      }
    ];
  }, [collapseAllSidebarTrees]);

  return (
    <>
      <aside className="flex shrink-0 flex-col overflow-x-hidden bg-sidebar" style={{ width }}>
        <SidebarPanelSwitcher panels={pluginSidebarPanels} activePanelId={activeSidebarPanelId} />
        {activeSidebarPanel ? (
          <Scrollbars axis="vertical" className="flex-1 min-h-0 px-2 py-2">
            <PluginSurface
              pluginId={activeSidebarPanel.pluginId}
              contributionId={activeSidebarPanel.contributionId}
              kind="sidebarPanels"
              minHeight={240}
            />
          </Scrollbars>
        ) : (
          <>
            <SidebarSearch value={searchQuery} onChange={setSearchQuery} />
            <Toolbar
              ariaLabel="Collections sidebar"
              actions={toolbarActions}
              toggles={toolbarToggles}
            />
            <Scrollbars axis="vertical" className="flex-1 min-h-0 px-2 pb-3">
              {searchLoading ? (
                <p className="mt-1.5 text-[16px] text-muted" role="status">
                  Loading…
                </p>
              ) : null}

              <ControlledAccordion providerValue={accordion}>
                {collectionsSectionVisible ? (
                  <nav aria-label="Collections" data-sidebar-section="collections">
                    <Section
                      itemKey="collections"
                      title="Collections"
                      initialEntered={collectionsSectionExpanded}
                      onAdd={() => dispatch(openCollectionModal({ mode: 'create' }))}
                      addLabel="Add Collection"
                    >
                      <Collections />
                    </Section>
                  </nav>
                ) : null}

                {environmentsSectionVisible ? (
                  <nav aria-label="Environments" data-sidebar-section="environments">
                    <Section
                      itemKey="environments"
                      title="Environments"
                      initialEntered={environmentsSectionExpanded}
                      onAdd={openAddEnvironment}
                      addLabel="Add Environment"
                    >
                      <Environments />
                    </Section>
                  </nav>
                ) : null}

                {runResultsSectionVisible ? (
                  <nav aria-label="Run results" data-sidebar-section="runResults">
                    <Section
                      itemKey="runResults"
                      title="Run Results"
                      initialEntered={runResultsSectionExpanded}
                    >
                      <RunResults />
                    </Section>
                  </nav>
                ) : null}

                {pluginSidebarSections.map((section) => {
                  const expanded = pluginSectionExpanded[section.id] ?? true;
                  return (
                    <nav key={section.id} aria-label={section.title}>
                      <Section
                        itemKey={section.id}
                        title={section.title}
                        initialEntered={expanded}
                        headerActions={
                          section.hasHeaderActions ? (
                            <PluginSurface
                              pluginId={section.pluginId}
                              contributionId={section.contributionId}
                              kind="sidebarSections"
                              slot="headerActions"
                            />
                          ) : undefined
                        }
                      >
                        <PluginSurface
                          pluginId={section.pluginId}
                          contributionId={section.contributionId}
                          kind="sidebarSections"
                          minHeight={120}
                        />
                      </Section>
                    </nav>
                  );
                })}
              </ControlledAccordion>
            </Scrollbars>
          </>
        )}
      </aside>

      <ResizeHandle
        orientation="vertical"
        value={width}
        min={sidebarMinSize}
        max={sidebarMaxSize}
        onResizeStart={onResizeStart}
        onKeyboardResize={onKeyboardResize}
        ariaLabel="Resize sidebar"
      />
    </>
  );
}

/**
 * Left sidebar with collapsible collections, environments, and run-results
 * sections. Mounts the sidebar context providers (providers, git, search, and
 * modals) so each section can own its own data and actions.
 */
export function CollectionSidebar(): JSX.Element {
  return (
    <SidebarProvidersProvider>
      <SidebarGitProvider>
        <SidebarSearchProvider>
          <SidebarModalsProvider>
            <SidebarContent />
          </SidebarModalsProvider>
        </SidebarSearchProvider>
      </SidebarGitProvider>
    </SidebarProvidersProvider>
  );
}
