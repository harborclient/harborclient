import { useMemo, type JSX } from 'react';
import { HostedSurface } from '#/renderer/src/plugins/HostedSurface';
import {
  usePluginSidebarPanels,
  usePluginSidebarSections
} from '#/renderer/src/plugins/pluginHooks';
import {
  faSquareMinus,
  faClock,
  faClockRotateLeft,
  faCloud,
  faFolder,
  faLayerGroup,
  faPalette,
  faSun,
  faTrash
} from '#/renderer/src/fontawesome';
import {
  Sidebar,
  SidebarSections,
  Toolbar,
  type SidebarSectionConfig,
  type ToolbarAction
} from '@harborclient/sdk/components';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActiveEnvironmentId,
  selectSelectedCollectionId
} from '#/renderer/src/store/selectors';
import { selectActiveSidebarPanelId } from '#/renderer/src/store/slices/navigationSlice';
import { openCollectionModal } from '#/renderer/src/store/slices/modalsSlice';
import { requestCreateTabGroupFromOpenTabs } from '#/renderer/src/store/thunks/tabGroups';
import { Collections } from '#/renderer/src/ui/Sidebars/CollectionSidebar/Collections';
import { Environments } from '#/renderer/src/ui/Sidebars/CollectionSidebar/Environments';
import {
  History,
  HistoryHeaderActions
} from '#/renderer/src/ui/Sidebars/CollectionSidebar/History';
import {
  RunResults,
  RunsHeaderActions
} from '#/renderer/src/ui/Sidebars/CollectionSidebar/RunResults';
import { TabGroups } from '#/renderer/src/ui/Sidebars/CollectionSidebar/TabGroups';
import { Trash, TrashHeaderActions } from '#/renderer/src/ui/Sidebars/CollectionSidebar/Trash';
import { SidebarSearch } from '#/renderer/src/ui/Sidebars/CollectionSidebar/SidebarSearch';
import { SidebarPanelSwitcher } from '#/renderer/src/ui/Sidebars/CollectionSidebar/SidebarPanelSwitcher';
import { useSidebarSearchContext } from '#/renderer/src/ui/Sidebars/CollectionSidebar/sidebarSearchContext';
import { useSidebarModals } from '#/renderer/src/ui/Sidebars/CollectionSidebar/sidebarModalsContext';
import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/useSidebarExpansion';
import { useSidebarListNavigation } from '#/renderer/src/ui/Sidebars/CollectionSidebar/useSidebarListNavigation';
import { useSidebarAccordion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/useSidebarAccordion';

/**
 * Inner sidebar body rendered inside the sidebar context providers. Composes
 * the panel switcher, search field, section toolbar, and the collapsible
 * Collections/Runs/History/Environments/Tab Groups sections. Sections source their own
 * data and actions, so this shell only wires layout and shared UI state.
 */
export function SidebarContent(): JSX.Element {
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
    historySectionExpanded,
    tabGroupsSectionExpanded,
    trashSectionExpanded,
    collectionsSectionVisible,
    environmentsSectionVisible,
    runResultsSectionVisible,
    historySectionVisible,
    tabGroupsSectionVisible,
    trashSectionVisible,
    showStorageLocationBadges,
    toggleStorageLocationBadges,
    showColorDots,
    toggleColorDots,
    toggleCollectionsSectionVisible,
    toggleEnvironmentsSectionVisible,
    toggleRunResultsSectionVisible,
    toggleHistorySectionVisible,
    toggleTabGroupsSectionVisible,
    toggleTrashSectionVisible
  } = useSidebarExpansion();

  const { searchQuery, setSearchQuery, searchActive, searchLoading, collapseAllSidebarTrees } =
    useSidebarSearchContext();
  const { openAddEnvironment } = useSidebarModals();
  const { expanded, onToggle, pluginSectionExpanded } = useSidebarAccordion();

  useSidebarListNavigation(selectedCollectionId, activeEnvironmentId);

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
        id: 'toggle-run-results-section',
        icon: faClockRotateLeft,
        label: 'Runs',
        title: runResultsSectionVisible ? 'Hide runs section' : 'Show runs section',
        ariaPressed: runResultsSectionVisible,
        onClick: toggleRunResultsSectionVisible
      },
      {
        id: 'toggle-history-section',
        icon: faClock,
        label: 'History',
        title: historySectionVisible ? 'Hide history section' : 'Show history section',
        ariaPressed: historySectionVisible,
        onClick: toggleHistorySectionVisible
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
        id: 'toggle-tab-groups-section',
        icon: faLayerGroup,
        label: 'Tab Groups',
        title: tabGroupsSectionVisible ? 'Hide tab groups section' : 'Show tab groups section',
        ariaPressed: tabGroupsSectionVisible,
        onClick: toggleTabGroupsSectionVisible
      },
      {
        id: 'toggle-trash-section',
        icon: faTrash,
        label: 'Trash',
        title: trashSectionVisible ? 'Hide trash section' : 'Show trash section',
        ariaPressed: trashSectionVisible,
        onClick: toggleTrashSectionVisible
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
      },
      {
        id: 'toggle-color-dots',
        icon: faPalette,
        label: 'Color dots',
        title: showColorDots ? 'Hide color dots' : 'Show color dots',
        ariaPressed: showColorDots,
        onClick: toggleColorDots
      }
    ];
  }, [
    collectionsSectionVisible,
    environmentsSectionVisible,
    historySectionVisible,
    tabGroupsSectionVisible,
    trashSectionVisible,
    runResultsSectionVisible,
    toggleCollectionsSectionVisible,
    toggleEnvironmentsSectionVisible,
    toggleHistorySectionVisible,
    toggleTabGroupsSectionVisible,
    toggleTrashSectionVisible,
    toggleRunResultsSectionVisible,
    showStorageLocationBadges,
    toggleStorageLocationBadges,
    showColorDots,
    toggleColorDots
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

  /**
   * Collapsible section config for the collections sidebar body.
   */
  const sections = useMemo((): SidebarSectionConfig[] => {
    const result: SidebarSectionConfig[] = [];

    if (collectionsSectionVisible) {
      result.push({
        key: 'collections',
        title: 'Collections',
        ariaLabel: 'Collections',
        initialEntered: collectionsSectionExpanded,
        onAdd: () => dispatch(openCollectionModal({ mode: 'create' })),
        addLabel: 'Add Collection',
        children: <Collections key={searchActive ? 'search' : 'browse'} />
      });
    }

    if (runResultsSectionVisible) {
      result.push({
        key: 'runResults',
        title: 'Runs',
        ariaLabel: 'Runs',
        initialEntered: runResultsSectionExpanded,
        headerActions: <RunsHeaderActions />,
        children: <RunResults />
      });
    }

    if (historySectionVisible) {
      result.push({
        key: 'history',
        title: 'History',
        ariaLabel: 'History',
        initialEntered: historySectionExpanded,
        headerActions: <HistoryHeaderActions />,
        children: <History />
      });
    }

    if (environmentsSectionVisible) {
      result.push({
        key: 'environments',
        title: 'Environments',
        ariaLabel: 'Environments',
        initialEntered: environmentsSectionExpanded,
        onAdd: openAddEnvironment,
        addLabel: 'Add Environment',
        children: <Environments />
      });
    }

    if (tabGroupsSectionVisible) {
      result.push({
        key: 'tabGroups',
        title: 'Tab Groups',
        ariaLabel: 'Tab Groups',
        initialEntered: tabGroupsSectionExpanded,
        onAdd: () => void dispatch(requestCreateTabGroupFromOpenTabs()),
        addLabel: 'Add Tab Group',
        children: <TabGroups />
      });
    }

    if (trashSectionVisible) {
      result.push({
        key: 'trash',
        title: 'Trash',
        ariaLabel: 'Trash',
        initialEntered: trashSectionExpanded,
        headerActions: <TrashHeaderActions />,
        children: <Trash />
      });
    }

    for (const section of pluginSidebarSections) {
      const sectionExpanded = pluginSectionExpanded[section.id] ?? true;
      result.push({
        key: section.id,
        title: section.title,
        ariaLabel: section.title,
        initialEntered: sectionExpanded,
        headerActions: section.hasHeaderActions ? (
          <HostedSurface
            pluginId={section.pluginId}
            contributionId={section.contributionId}
            kind="sidebarSections"
            slot="headerActions"
          />
        ) : undefined,
        children: (
          <HostedSurface
            pluginId={section.pluginId}
            contributionId={section.contributionId}
            kind="sidebarSections"
            minHeight={120}
          />
        )
      });
    }

    return result;
  }, [
    collectionsSectionVisible,
    collectionsSectionExpanded,
    dispatch,
    environmentsSectionVisible,
    environmentsSectionExpanded,
    historySectionVisible,
    historySectionExpanded,
    openAddEnvironment,
    pluginSectionExpanded,
    pluginSidebarSections,
    runResultsSectionVisible,
    runResultsSectionExpanded,
    searchActive,
    tabGroupsSectionVisible,
    tabGroupsSectionExpanded,
    trashSectionVisible,
    trashSectionExpanded
  ]);

  return (
    <Sidebar
      side="left"
      ariaLabel="Collections sidebar"
      storageKey="hc.sidebarWidth"
      defaultSize={400}
      minSize={240}
      getMaxSize={() => 640}
      resizeAriaLabel="Resize sidebar"
      header={
        <>
          <SidebarPanelSwitcher panels={pluginSidebarPanels} activePanelId={activeSidebarPanelId} />
          {!activeSidebarPanel ? (
            <>
              <SidebarSearch value={searchQuery} onChange={setSearchQuery} />
              <Toolbar
                ariaLabel="Collections sidebar"
                actions={toolbarActions}
                toggles={toolbarToggles}
              />
            </>
          ) : null}
        </>
      }
      bodyClassName={activeSidebarPanel ? 'px-2 py-2' : 'pr-2 pb-3'}
    >
      {activeSidebarPanel ? (
        <HostedSurface
          pluginId={activeSidebarPanel.pluginId}
          contributionId={activeSidebarPanel.contributionId}
          kind="sidebarPanels"
          minHeight={240}
        />
      ) : (
        <>
          {searchLoading ? (
            <p className="mt-1.5 text-muted" role="status">
              Loading…
            </p>
          ) : null}
          <SidebarSections sections={sections} expanded={expanded} onToggle={onToggle} />
        </>
      )}
    </Sidebar>
  );
}
