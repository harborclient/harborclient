import { useCallback, useMemo, type JSX } from 'react';
import type { SidebarMode, SidebarSectionKey } from '@harborclient/core/types';
import { SIDEBAR_MODE_SECTIONS } from '@harborclient/core/sidebarExpansion';
import type { SidebarPanelViewContext } from '@harborclient/sdk';
import { HostedSurface } from '#/renderer/src/plugins/HostedSurface';
import {
  selectionFromState,
  selectionsEqual
} from '#/renderer/src/plugins/sidebarSelectionMapping';
import { usePluginSidebarSections } from '#/renderer/src/plugins/pluginHooks';
import {
  faDiagramProject,
  faFolder,
  faGlobe,
  faLayerGroup,
  faTrash
} from '#/renderer/src/fontawesome';
import {
  Sidebar,
  SidebarRail,
  SidebarSections,
  type SidebarRailItemData,
  type SidebarSectionConfig
} from '@harborclient/sdk/components';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActiveEnvironmentId,
  selectSelectedCollectionId
} from '#/renderer/src/store/selectors';
import { openCollectionModal } from '#/renderer/src/store/slices/modalsSlice';
import { requestCreateWorkspaceFromOpenTabs } from '#/renderer/src/store/thunks/workspaces';
import { openWorkflowRecordDialog } from '#/renderer/src/store/slices/workflowsSlice';
import { clearPlayback, stopPlayback } from '#/renderer/src/workflows/workflowPlayback';
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
import { hasExpandedSidebarTreesForMode } from '../expansion/hasExpandedSidebarTrees';
import { useSidebarExpansion } from '../expansion/useSidebarExpansion';
import { useSidebarListNavigation } from '../navigation/useSidebarListNavigation';
import { useSidebarAccordion } from '../expansion/useSidebarAccordion';
import { SidebarCollapseAllHeader } from './SidebarCollapseAllHeader';

const SIDEBAR_RAIL_ITEMS: SidebarRailItemData[] = [
  { id: 'collections', icon: faFolder, label: 'Collections' },
  { id: 'environments', icon: faGlobe, label: 'Environments' },
  { id: 'workspaces', icon: faLayerGroup, label: 'Workspaces' },
  { id: 'workflows', icon: faDiagramProject, label: 'Workflows' },
  { id: 'trash', icon: faTrash, label: 'Trash' }
];

/**
 * Returns whether a value is a known {@link SidebarMode}.
 *
 * @param value - Candidate rail item id.
 */
function isSidebarMode(value: string): value is SidebarMode {
  return (
    value === 'collections' ||
    value === 'environments' ||
    value === 'workspaces' ||
    value === 'workflows' ||
    value === 'trash'
  );
}

/**
 * Inner sidebar body rendered inside the sidebar context providers. Composes
 * search above a vertical activity rail and the section accordion, with a
 * collapse-all header row aligned to section action buttons.
 * Sections source their own data and actions; this shell wires layout and mode state.
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
    activeSidebarMode,
    setActiveSidebarMode,
    sidebarRailExpanded,
    setSidebarRailExpanded,
    expandedCollectionIds,
    expandedFolderIds,
    expandedEnvironmentIds
  } = useSidebarExpansion();

  const {
    searchQuery,
    setSearchQuery,
    activeSearchFilter,
    archivedSearchFilter,
    searchActive,
    searchLoading,
    collapseSidebarTreesForMode
  } = useSidebarSearchContext();
  const { openAddEnvironment } = useSidebarModals();
  const { expanded, onToggle, pluginSectionExpanded, collapseSections } = useSidebarAccordion();

  useSidebarListNavigation(selectedCollectionId, activeEnvironmentId);

  /**
   * Selects an activity-rail mode from a rail item id.
   *
   * @param id - Rail item id matching a {@link SidebarMode}.
   */
  const handleRailSelect = useCallback(
    (id: string): void => {
      if (isSidebarMode(id)) {
        setActiveSidebarMode(id);
      }
    },
    [setActiveSidebarMode]
  );

  /**
   * Section keys to mount: search hit union while searching, otherwise the active mode set.
   */
  const mountedSectionKeys = useMemo((): readonly SidebarSectionKey[] => {
    if (!searchActive || activeSearchFilter == null) {
      return SIDEBAR_MODE_SECTIONS[activeSidebarMode];
    }

    const keys: SidebarSectionKey[] = [];
    const hasCollectionHits =
      activeSearchFilter.collectionIds.size > 0 ||
      activeSearchFilter.folderIds.size > 0 ||
      activeSearchFilter.requestIds.size > 0;
    const hasEnvironmentHits = activeSearchFilter.environmentIds.size > 0;
    const hasArchiveHits = (archivedSearchFilter?.collectionIds.size ?? 0) > 0;

    if (hasCollectionHits) {
      keys.push('collections');
    }
    if (hasEnvironmentHits) {
      keys.push('environments');
    }
    if (hasArchiveHits) {
      keys.push('archive');
    }

    return keys.length > 0 ? keys : SIDEBAR_MODE_SECTIONS[activeSidebarMode];
  }, [activeSearchFilter, activeSidebarMode, archivedSearchFilter, searchActive]);

  /**
   * Whether the current mount set includes a given section key.
   *
   * @param key - Built-in section key.
   */
  const isSectionMounted = useCallback(
    (key: SidebarSectionKey): boolean => mountedSectionKeys.includes(key),
    [mountedSectionKeys]
  );

  /**
   * Collapsible section config for the sidebar body driven by rail mode / search.
   */
  const sections = useMemo((): SidebarSectionConfig[] => {
    const result: SidebarSectionConfig[] = [];

    if (isSectionMounted('collections')) {
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

    if (isSectionMounted('runResults')) {
      result.push({
        key: 'runResults',
        title: 'Runs',
        ariaLabel: 'Runs',
        initialEntered: runResultsSectionExpanded,
        headerActions: <RunsHeaderActions />,
        children: <RunResults />
      });
    }

    if (isSectionMounted('history')) {
      result.push({
        key: 'history',
        title: 'History',
        ariaLabel: 'History',
        initialEntered: historySectionExpanded,
        headerActions: <HistoryHeaderActions />,
        children: <History />
      });
    }

    if (isSectionMounted('environments')) {
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

    if (isSectionMounted('workspaces')) {
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

    if (isSectionMounted('workflows')) {
      result.push({
        key: 'workflows',
        title: 'Workflows',
        ariaLabel: 'Workflows',
        initialEntered: workflowsSectionExpanded,
        onAdd: () => {
          stopPlayback();
          clearPlayback();
          dispatch(openWorkflowRecordDialog());
        },
        addLabel: 'Record workflow',
        children: <Workflows />
      });
    }

    if (isSectionMounted('archive')) {
      result.push({
        key: 'archive',
        title: 'Archive',
        ariaLabel: 'Archive',
        initialEntered: archiveSectionExpanded,
        headerActions: <ArchiveHeaderActions />,
        children: <Archive />
      });
    }

    if (isSectionMounted('trash')) {
      result.push({
        key: 'trash',
        title: 'Trash',
        ariaLabel: 'Trash',
        initialEntered: trashSectionExpanded,
        headerActions: <TrashHeaderActions />,
        children: <Trash />
      });
    }

    if (activeSidebarMode === 'collections' && !searchActive) {
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
    }

    return result;
  }, [
    activeSidebarMode,
    archiveSectionExpanded,
    collectionsSectionExpanded,
    dispatch,
    environmentsSectionExpanded,
    historySectionExpanded,
    isSectionMounted,
    openAddEnvironment,
    pluginSectionExpanded,
    pluginSidebarSections,
    runResultsSectionExpanded,
    searchActive,
    trashSectionExpanded,
    workspacesSectionExpanded,
    workflowsSectionExpanded
  ]);

  /**
   * Collapses trees for the active rail mode first; when none remain expanded for that
   * mode, collapses only the section headers currently visible in the sidebar body.
   */
  const handleCollapseAll = useCallback((): void => {
    if (
      hasExpandedSidebarTreesForMode(
        activeSidebarMode,
        expandedCollectionIds,
        expandedFolderIds,
        expandedEnvironmentIds
      )
    ) {
      collapseSidebarTreesForMode(activeSidebarMode);
      return;
    }

    collapseSections(sections.map((section) => section.key));
  }, [
    activeSidebarMode,
    collapseSections,
    collapseSidebarTreesForMode,
    expandedCollectionIds,
    expandedEnvironmentIds,
    expandedFolderIds,
    sections
  ]);

  const showChrome = !displayedPanel;

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar">
      {showChrome ? (
        <div className="shrink-0 border-b border-separator">
          <SidebarSearch value={searchQuery} onChange={setSearchQuery} loading={searchLoading} />
        </div>
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1">
        {showChrome ? (
          <SidebarRail
            items={SIDEBAR_RAIL_ITEMS}
            activeId={activeSidebarMode}
            expanded={sidebarRailExpanded}
            onExpandedChange={setSidebarRailExpanded}
            onSelect={handleRailSelect}
            ariaLabel="Sidebar"
          />
        ) : null}
        <Sidebar
          side="left"
          ariaLabel="Sidebar"
          storageKey="hc.sidebarWidth"
          defaultSize={400}
          minSize={240}
          getMaxSize={() => 640}
          resizeAriaLabel="Resize sidebar"
          scroll={!displayedPanel}
          asideClassName="h-full min-h-0"
          header={
            <SidebarPanelSwitcher
              panels={switcherPanels}
              activePanelId={activePanelId}
              collectionsReplacement={collectionsReplacement}
              showSwitcher={showSwitcher}
            />
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
              <SidebarCollapseAllHeader onClick={handleCollapseAll} />
              <SidebarSections sections={sections} expanded={expanded} onToggle={onToggle} />
            </>
          )}
        </Sidebar>
      </div>
    </div>
  );
}
