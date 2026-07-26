import { useCallback, useMemo, useRef, useState, type JSX } from 'react';
import { HostedSurface } from '#/renderer/src/plugins/HostedSurface';
import {
  usePluginSidebarPanels,
  usePluginSidebarSections
} from '#/renderer/src/plugins/pluginHooks';
import {
  faSquareMinus,
  faClockRotateLeft,
  faEye,
  faFolder,
  faGlobe,
  faLayerGroup,
  faPlay,
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
import { Collections } from '../Collections';
import { Environments } from '../Environments';
import { History, HistoryHeaderActions } from '../History';
import { RunResults, RunsHeaderActions } from '../RunResults';
import { TabGroups } from '../TabGroups';
import { Trash, TrashHeaderActions } from '../Trash';
import { SidebarSearch } from '../search/SidebarSearch';
import { SidebarPanelSwitcher } from './SidebarPanelSwitcher';
import { SidebarViewMenu } from './SidebarViewMenu';
import { useSidebarSearchContext } from '../search/sidebarSearchContext';
import { useSidebarModals } from '../modals/sidebarModalsContext';
import { hasExpandedSidebarTrees } from '../expansion/hasExpandedSidebarTrees';
import { useSidebarExpansion } from '../expansion/useSidebarExpansion';
import { useSidebarListNavigation } from '../navigation/useSidebarListNavigation';
import { useSidebarAccordion } from '../expansion/useSidebarAccordion';

/**
 * Inner sidebar body rendered inside the sidebar context providers. Composes
 * the panel switcher, search field, section toolbar (visibility toggles, View
 * menu, collapse-all), and the collapsible Collections/Runs/History/Environments/
 * Tab Groups sections. Sections source their own data and actions, so this shell
 * only wires layout and shared UI state.
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
    expandedCollectionIds,
    expandedFolderIds,
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
  const { expanded, onToggle, pluginSectionExpanded, collapseAllSections } = useSidebarAccordion();

  useSidebarListNavigation(selectedCollectionId, activeEnvironmentId);

  const viewMenuButtonRef = useRef<HTMLButtonElement>(null);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);

  /**
   * Collapses collection/folder trees first; when none remain expanded, collapses
   * every sidebar section header (built-in and plugin).
   */
  const handleCollapseAll = useCallback((): void => {
    if (hasExpandedSidebarTrees(expandedCollectionIds, expandedFolderIds)) {
      collapseAllSidebarTrees();
      return;
    }

    collapseAllSections();
  }, [collapseAllSections, collapseAllSidebarTrees, expandedCollectionIds, expandedFolderIds]);

  /**
   * Resolves the active switchable sidebar panel contribution, if any.
   */
  const activeSidebarPanel = useMemo(
    () => pluginSidebarPanels.find((panel) => panel.id === activeSidebarPanelId) ?? null,
    [pluginSidebarPanels, activeSidebarPanelId]
  );

  /**
   * Left toolbar actions that show or hide sidebar sections.
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
        icon: faPlay,
        label: 'Runs',
        title: runResultsSectionVisible ? 'Hide runs section' : 'Show runs section',
        ariaPressed: runResultsSectionVisible,
        onClick: toggleRunResultsSectionVisible
      },
      {
        id: 'toggle-history-section',
        icon: faClockRotateLeft,
        label: 'History',
        title: historySectionVisible ? 'Hide history section' : 'Show history section',
        ariaPressed: historySectionVisible,
        onClick: toggleHistorySectionVisible
      },
      {
        id: 'toggle-environments-section',
        icon: faGlobe,
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
    toggleRunResultsSectionVisible
  ]);

  /**
   * Right-aligned toolbar controls: display preferences (View) and collapse-all.
   */
  const toolbarToggles = useMemo((): ToolbarAction[] => {
    const viewOptionsActive = showStorageLocationBadges || showColorDots;

    return [
      {
        id: 'view-options',
        icon: faEye,
        label: 'View options',
        title: 'View options',
        ariaHaspopup: 'menu',
        ariaExpanded: viewMenuOpen,
        ariaPressed: viewOptionsActive,
        buttonRef: viewMenuButtonRef,
        onClick: () => setViewMenuOpen((open) => !open),
        popover: viewMenuOpen ? (
          <SidebarViewMenu
            anchorRef={viewMenuButtonRef}
            showStorageLocationBadges={showStorageLocationBadges}
            showColorDots={showColorDots}
            onToggleStorageLocationBadges={toggleStorageLocationBadges}
            onToggleColorDots={toggleColorDots}
            onClose={() => setViewMenuOpen(false)}
          />
        ) : undefined
      },
      {
        id: 'collapse-all',
        icon: faSquareMinus,
        label: 'Collapse all',
        title: 'Collapse all collections, folders, and sections',
        onClick: handleCollapseAll
      }
    ];
  }, [
    handleCollapseAll,
    showColorDots,
    showStorageLocationBadges,
    toggleColorDots,
    toggleStorageLocationBadges,
    viewMenuOpen
  ]);

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
