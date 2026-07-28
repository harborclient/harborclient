import { useCallback, useMemo, type JSX } from 'react';
import type { SidebarPanelViewContext } from '@harborclient/sdk';
import { HostedSurface } from '#/renderer/src/plugins/HostedSurface';
import {
  selectionFromState,
  selectionsEqual
} from '#/renderer/src/plugins/sidebarSelectionMapping';
import { usePluginSidebarSections } from '#/renderer/src/plugins/pluginHooks';
import {
  faSquareMinus,
  faBoxArchive,
  faClockRotateLeft,
  faFolder,
  faGlobe,
  faLayerGroup,
  faDiagramProject,
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
import { openCollectionModal } from '#/renderer/src/store/slices/modalsSlice';
import { requestCreateWorkspaceFromOpenTabs } from '#/renderer/src/store/thunks/workspaces';
import { setWorkflowRecordingDialogOpen } from '#/renderer/src/store/slices/workflowsSlice';
import { Collections, CollectionsHeaderActions } from '../Collections';
import { Environments, EnvironmentsHeaderActions } from '../Environments';
import { History, HistoryHeaderActions } from '../History';
import { RunResults, RunsHeaderActions } from '../RunResults';
import { Workspaces, WorkspacesHeaderActions } from '../Workspaces';
import { Workflows } from '../Workflows';
import { Archive, ArchiveHeaderActions } from '../Archive';
import { Trash, TrashHeaderActions } from '../Trash';
import { SidebarSearch } from '../search/SidebarSearch';
import { SidebarPanelSwitcher } from './SidebarPanelSwitcher';
import { useResolvedSidebarPanels } from './useResolvedSidebarPanels';
import { useSidebarSearchContext } from '../search/sidebarSearchContext';
import { useSidebarModals } from '../modals/sidebarModalsContext';
import { hasExpandedSidebarTrees } from '../expansion/hasExpandedSidebarTrees';
import { useSidebarExpansion } from '../expansion/useSidebarExpansion';
import { useSidebarListNavigation } from '../navigation/useSidebarListNavigation';
import { useSidebarAccordion } from '../expansion/useSidebarAccordion';

/**
 * Inner sidebar body rendered inside the sidebar context providers. Composes
 * the panel switcher, search field, section toolbar (visibility toggles and
 * collapse-all), and the collapsible Collections/Runs/History/Environments/
 * Workspaces sections. Sections source their own data and actions, so this shell
 * only wires layout and shared UI state.
 *
 * When a registered panel declares `replaces: "collections"`, that panel becomes
 * the default body (primary collections surface) and the built-in tree is hidden.
 */
export function SidebarContent(): JSX.Element {
  const dispatch = useAppDispatch();
  const selectedCollectionId = useAppSelector(selectSelectedCollectionId);
  const activeEnvironmentId = useAppSelector(selectActiveEnvironmentId);
  const sidebarSelection = useAppSelector(selectionFromState, selectionsEqual);
  /**
   * Stable view context for sidebar panel HostedSurface mounts.
   * Recreates only when the derived selection identity changes.
   */
  const sidebarPanelContext = useMemo(
    (): SidebarPanelViewContext => ({ sidebarSelection }),
    [sidebarSelection]
  );
  const pluginSidebarSections = usePluginSidebarSections();
  const { activePanelId, collectionsReplacement, displayedPanel, switcherPanels, showSwitcher } =
    useResolvedSidebarPanels();

  const {
    collectionsSectionExpanded,
    environmentsSectionExpanded,
    runResultsSectionExpanded,
    historySectionExpanded,
    workspacesSectionExpanded,
    workflowsSectionExpanded,
    archiveSectionExpanded,
    trashSectionExpanded,
    collectionsSectionVisible,
    environmentsSectionVisible,
    runResultsSectionVisible,
    historySectionVisible,
    workspacesSectionVisible,
    workflowsSectionVisible,
    archiveSectionVisible,
    trashSectionVisible,
    expandedCollectionIds,
    expandedFolderIds,
    toggleCollectionsSectionVisible,
    toggleEnvironmentsSectionVisible,
    toggleRunResultsSectionVisible,
    toggleHistorySectionVisible,
    toggleWorkspacesSectionVisible,
    toggleWorkflowsSectionVisible,
    toggleArchiveSectionVisible,
    toggleTrashSectionVisible
  } = useSidebarExpansion();

  const { searchQuery, setSearchQuery, searchActive, searchLoading, collapseAllSidebarTrees } =
    useSidebarSearchContext();
  const { openAddEnvironment } = useSidebarModals();
  const { expanded, onToggle, pluginSectionExpanded, collapseAllSections } = useSidebarAccordion();

  useSidebarListNavigation(selectedCollectionId, activeEnvironmentId);

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
        label: 'Workspaces',
        title: workspacesSectionVisible ? 'Hide workspaces section' : 'Show workspaces section',
        ariaPressed: workspacesSectionVisible,
        onClick: toggleWorkspacesSectionVisible
      },
      {
        id: 'toggle-workflows-section',
        icon: faDiagramProject,
        label: 'Workflows',
        title: workflowsSectionVisible ? 'Hide workflows section' : 'Show workflows section',
        ariaPressed: workflowsSectionVisible,
        onClick: toggleWorkflowsSectionVisible
      },
      {
        id: 'toggle-archive-section',
        icon: faBoxArchive,
        label: 'Archive',
        title: archiveSectionVisible ? 'Hide archive section' : 'Show archive section',
        ariaPressed: archiveSectionVisible,
        onClick: toggleArchiveSectionVisible
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
    archiveSectionVisible,
    collectionsSectionVisible,
    environmentsSectionVisible,
    historySectionVisible,
    workspacesSectionVisible,
    workflowsSectionVisible,
    trashSectionVisible,
    runResultsSectionVisible,
    toggleArchiveSectionVisible,
    toggleCollectionsSectionVisible,
    toggleEnvironmentsSectionVisible,
    toggleHistorySectionVisible,
    toggleWorkspacesSectionVisible,
    toggleWorkflowsSectionVisible,
    toggleTrashSectionVisible,
    toggleRunResultsSectionVisible
  ]);

  /**
   * Right-aligned toolbar controls: collapse-all.
   */
  const toolbarToggles = useMemo((): ToolbarAction[] => {
    return [
      {
        id: 'collapse-all',
        icon: faSquareMinus,
        label: 'Collapse all',
        title: 'Collapse all collections, folders, and sections',
        onClick: handleCollapseAll
      }
    ];
  }, [handleCollapseAll]);

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
        headerActions: <CollectionsHeaderActions />,
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
        headerActions: <EnvironmentsHeaderActions />,
        children: <Environments />
      });
    }

    if (workspacesSectionVisible) {
      result.push({
        key: 'workspaces',
        title: 'Workspaces',
        ariaLabel: 'Workspaces',
        initialEntered: workspacesSectionExpanded,
        onAdd: () => void dispatch(requestCreateWorkspaceFromOpenTabs()),
        addLabel: 'Add Workspace',
        headerActions: <WorkspacesHeaderActions />,
        children: <Workspaces />
      });
    }

    if (workflowsSectionVisible) {
      result.push({
        key: 'workflows',
        title: 'Workflows',
        ariaLabel: 'Workflows',
        initialEntered: workflowsSectionExpanded,
        onAdd: () => dispatch(setWorkflowRecordingDialogOpen(true)),
        addLabel: 'Record workflow',
        children: <Workflows />
      });
    }

    if (archiveSectionVisible) {
      result.push({
        key: 'archive',
        title: 'Archive',
        ariaLabel: 'Archive',
        initialEntered: archiveSectionExpanded,
        headerActions: <ArchiveHeaderActions />,
        children: <Archive />
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
    workspacesSectionVisible,
    workspacesSectionExpanded,
    workflowsSectionVisible,
    workflowsSectionExpanded,
    archiveSectionVisible,
    archiveSectionExpanded,
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
      scroll={!displayedPanel}
      asideClassName={displayedPanel ? 'h-full min-h-0' : undefined}
      header={
        <>
          <SidebarPanelSwitcher
            panels={switcherPanels}
            activePanelId={activePanelId}
            collectionsReplacement={collectionsReplacement}
            showSwitcher={showSwitcher}
          />
          {!displayedPanel ? (
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
      bodyClassName={displayedPanel ? 'px-2 py-2' : 'pr-2 pb-3'}
    >
      {displayedPanel ? (
        <HostedSurface
          pluginId={displayedPanel.pluginId}
          contributionId={displayedPanel.contributionId}
          kind="sidebarPanels"
          resizeMode="fill"
          className="h-full"
          context={sidebarPanelContext}
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
