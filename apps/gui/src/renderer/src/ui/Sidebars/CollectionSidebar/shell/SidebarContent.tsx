import { useCallback, useMemo, type JSX } from 'react';
import type { SidebarMode, SidebarSectionKey } from '@harborclient/core/types';
import { SIDEBAR_MODE_SECTIONS } from '@harborclient/core/sidebarExpansion';
import type { SidebarPanelViewContext } from '@harborclient/sdk';
import { HostedSurface } from '#/renderer/src/plugins/HostedSurface';
import {
  selectionFromState,
  selectionsEqual
} from '#/renderer/src/plugins/sidebarSelectionMapping';
import {
  usePluginSidebarRailItems,
  usePluginSidebarSections
} from '#/renderer/src/plugins/pluginHooks';
import {
  faDiagramProject,
  faFolder,
  faGlobe,
  faLayerGroup,
  faServer,
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
import { openCollectionModal, openLiveServerModal } from '#/renderer/src/store/slices/modalsSlice';
import {
  selectActiveSidebarRailItemId,
  setActiveSidebarPanel,
  setActiveSidebarRailItem
} from '#/renderer/src/store/slices/navigationSlice';
import { requestCreateWorkspaceFromOpenTabs } from '#/renderer/src/store/thunks/workspaces';
import { openNewBrowserTab } from '#/renderer/src/store/thunks/websites';
import { openWorkflowRecordDialog } from '#/renderer/src/store/slices/workflowsSlice';
import { clearPlayback, stopPlayback } from '#/renderer/src/workflows/workflowPlayback';
import { resolvePluginTabIcon } from '#/renderer/src/routing/resolvePluginTabIcon';
import { Collections, CollectionsHeaderActions } from '../Collections';
import { Environments, EnvironmentsHeaderActions } from '../Environments';
import { History, HistoryHeaderActions } from '../History';
import { WorkflowHistory } from '../History/WorkflowHistory';
import { WorkflowHistoryHeaderActions } from '../History/WorkflowHistoryHeaderActions';
import { RunResults, RunsHeaderActions } from '../RunResults';
import { Workspaces, WorkspacesHeaderActions } from '../Workspaces';
import { Workflows } from '../Workflows';
import { Websites } from '../Websites';
import { LiveServers } from '../LiveServers';
import { Archive, ArchiveHeaderActions } from '../Archive';
import { WorkflowArchive } from '../Archive/WorkflowArchive';
import { WorkflowArchiveHeaderActions } from '../Archive/WorkflowArchiveHeaderActions';
import { Trash, TrashHeaderActions } from '../Trash';
import { SidebarSearch } from '../search/SidebarSearch';
import { SidebarPanelSwitcher } from './SidebarPanelSwitcher';
import { useResolvedSidebarPanels } from './useResolvedSidebarPanels';
import {
  mergeSidebarRailItems,
  resolveActiveSidebarRailItem,
  resolveSidebarChromeVisibility
} from './sidebarRailResolution';
import { useSidebarSearchContext } from '../search/sidebarSearchContext';
import { useSidebarModals } from '../modals/sidebarModalsContext';
import { useSidebarExpansion } from '../expansion/useSidebarExpansion';
import { useSidebarListNavigation } from '../navigation/useSidebarListNavigation';
import { useSidebarAccordion } from '../expansion/useSidebarAccordion';

const SIDEBAR_RAIL_ITEMS: SidebarRailItemData[] = [
  { id: 'collections', icon: faFolder, label: 'Collections' },
  { id: 'environments', icon: faGlobe, label: 'Environments' },
  { id: 'workspaces', icon: faLayerGroup, label: 'Workspaces' },
  { id: 'workflows', icon: faDiagramProject, label: 'Workflows' },
  { id: 'servers', icon: faServer, label: 'Servers' },
  { id: 'trash', icon: faTrash, label: 'Trash' }
];

/**
 * Stable id for the sidebar body panel controlled by rail tabs (`aria-controls`).
 */
const SIDEBAR_RAIL_PANEL_ID = 'hc-sidebar-rail-panel';

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
    value === 'servers' ||
    value === 'trash'
  );
}

/**
 * Inner sidebar body rendered inside the sidebar context providers. Composes
 * optional search, then the vertical activity rail and section accordion.
 * Sections source their own data and actions; this shell wires layout and mode state.
 *
 * When a registered panel declares `replaces: "collections"`, that panel becomes
 * the default body (primary collections surface) and the built-in tree is hidden.
 * Plugin `sidebarRailItems` append to the activity rail and open a HostedSurface
 * while keeping the rail visible (distinct from switcher `sidebarPanels`).
 */
export function SidebarContent(): JSX.Element {
  const dispatch = useAppDispatch();
  const selectedCollectionId = useAppSelector(selectSelectedCollectionId);
  const activeEnvironmentId = useAppSelector(selectActiveEnvironmentId);
  const activeSidebarRailItemId = useAppSelector(selectActiveSidebarRailItemId);
  const sidebarSelection = useAppSelector(selectionFromState, selectionsEqual);
  /**
   * Stable view context for sidebar panel and rail-item HostedSurface mounts.
   * Recreates only when the derived selection identity changes.
   */
  const sidebarPanelContext = useMemo(
    (): SidebarPanelViewContext => ({ sidebarSelection }),
    [sidebarSelection]
  );
  const pluginSidebarSections = usePluginSidebarSections();
  const pluginSidebarRailItems = usePluginSidebarRailItems();
  const { activePanelId, collectionsReplacement, displayedPanel, switcherPanels, showSwitcher } =
    useResolvedSidebarPanels();

  const {
    collectionsSectionExpanded,
    environmentsSectionExpanded,
    runResultsSectionExpanded,
    historySectionExpanded,
    workspacesSectionExpanded,
    workflowsSectionExpanded,
    websitesSectionExpanded,
    liveServersSectionExpanded,
    archiveSectionExpanded,
    trashSectionExpanded,
    activeSidebarMode,
    setActiveSidebarMode,
    sidebarRailExpanded,
    setSidebarRailExpanded
  } = useSidebarExpansion();

  const {
    searchQuery,
    setSearchQuery,
    activeSearchFilter,
    archivedSearchFilter,
    searchActive,
    searchLoading
  } = useSidebarSearchContext();
  const { openAddEnvironment } = useSidebarModals();
  const { expanded, onToggle, pluginSectionExpanded } = useSidebarAccordion();

  useSidebarListNavigation(selectedCollectionId, activeEnvironmentId);

  /**
   * Active plugin rail contribution, or null when a built-in mode / switcher panel is shown.
   * Stale ids (unregistered contributions) resolve to null and fall through to the
   * switcher panel or built-in accordion without writing Redux.
   */
  const activeRailItem = useMemo(
    () => resolveActiveSidebarRailItem(pluginSidebarRailItems, activeSidebarRailItemId),
    [pluginSidebarRailItems, activeSidebarRailItemId]
  );

  /**
   * Built-in modes plus registered plugin rail destinations.
   */
  const railItems = useMemo(
    () => mergeSidebarRailItems(SIDEBAR_RAIL_ITEMS, pluginSidebarRailItems, resolvePluginTabIcon),
    [pluginSidebarRailItems]
  );

  const { showSearch, showRail } = resolveSidebarChromeVisibility(
    displayedPanel != null && activeRailItem == null,
    activeRailItem != null
  );

  /**
   * Highlighted rail destination: plugin item when selected, otherwise the built-in mode.
   */
  const railActiveId = activeRailItem?.id ?? activeSidebarMode;

  /**
   * Selects a built-in mode or plugin rail destination from a rail item id.
   *
   * @param id - Built-in {@link SidebarMode} or namespaced plugin rail item id.
   */
  const handleRailSelect = useCallback(
    (id: string): void => {
      if (isSidebarMode(id)) {
        setActiveSidebarMode(id);
        dispatch(setActiveSidebarRailItem(null));
        dispatch(setActiveSidebarPanel(null));
        return;
      }
      dispatch(setActiveSidebarRailItem(id));
    },
    [dispatch, setActiveSidebarMode]
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
   *
   * Built-in sections follow {@link mountedSectionKeys} order (from
   * {@link SIDEBAR_MODE_SECTIONS}) so Workflows mode renders workflows → history → archive.
   */
  const sections = useMemo((): SidebarSectionConfig[] => {
    const byKey: Partial<Record<SidebarSectionKey, SidebarSectionConfig>> = {};

    if (isSectionMounted('collections')) {
      byKey.collections = {
        key: 'collections',
        title: 'Collections',
        ariaLabel: 'Collections',
        initialEntered: collectionsSectionExpanded,
        onAdd: () => dispatch(openCollectionModal({ mode: 'create' })),
        addLabel: 'Add Collection',
        headerActions: <CollectionsHeaderActions />,
        children: <Collections key={searchActive ? 'search' : 'browse'} />
      };
    }

    if (isSectionMounted('runResults')) {
      byKey.runResults = {
        key: 'runResults',
        title: 'Runs',
        ariaLabel: 'Runs',
        initialEntered: runResultsSectionExpanded,
        headerActions: <RunsHeaderActions />,
        children: <RunResults />
      };
    }

    if (isSectionMounted('history')) {
      byKey.history = {
        key: 'history',
        title: 'History',
        ariaLabel: 'History',
        initialEntered: historySectionExpanded,
        headerActions:
          activeSidebarMode === 'workflows' ? (
            <WorkflowHistoryHeaderActions />
          ) : (
            <HistoryHeaderActions />
          ),
        children: activeSidebarMode === 'workflows' ? <WorkflowHistory /> : <History />
      };
    }

    if (isSectionMounted('environments')) {
      byKey.environments = {
        key: 'environments',
        title: 'Environments',
        ariaLabel: 'Environments',
        initialEntered: environmentsSectionExpanded,
        onAdd: openAddEnvironment,
        addLabel: 'Add Environment',
        headerActions: <EnvironmentsHeaderActions />,
        children: <Environments />
      };
    }

    if (isSectionMounted('workspaces')) {
      byKey.workspaces = {
        key: 'workspaces',
        title: 'Workspaces',
        ariaLabel: 'Workspaces',
        initialEntered: workspacesSectionExpanded,
        onAdd: () => void dispatch(requestCreateWorkspaceFromOpenTabs()),
        addLabel: 'Add Workspace',
        headerActions: <WorkspacesHeaderActions />,
        children: <Workspaces />
      };
    }

    if (isSectionMounted('workflows')) {
      byKey.workflows = {
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
      };
    }

    if (isSectionMounted('websites')) {
      byKey.websites = {
        key: 'websites',
        title: 'Live pages',
        ariaLabel: 'Live pages',
        initialEntered: websitesSectionExpanded,
        onAdd: () => {
          dispatch(openNewBrowserTab());
        },
        addLabel: 'New live page',
        children: <Websites />
      };
    }

    if (isSectionMounted('liveServers')) {
      byKey.liveServers = {
        key: 'liveServers',
        title: 'Live Servers',
        ariaLabel: 'Live servers',
        initialEntered: liveServersSectionExpanded,
        onAdd: () => dispatch(openLiveServerModal({ mode: 'create' })),
        addLabel: 'New Live Server',
        children: <LiveServers />
      };
    }

    if (isSectionMounted('archive')) {
      byKey.archive = {
        key: 'archive',
        title: 'Archive',
        ariaLabel: 'Archive',
        initialEntered: archiveSectionExpanded,
        headerActions:
          activeSidebarMode === 'workflows' ? (
            <WorkflowArchiveHeaderActions />
          ) : (
            <ArchiveHeaderActions />
          ),
        children: activeSidebarMode === 'workflows' ? <WorkflowArchive /> : <Archive />
      };
    }

    if (isSectionMounted('trash')) {
      byKey.trash = {
        key: 'trash',
        title: 'Trash',
        ariaLabel: 'Trash',
        initialEntered: trashSectionExpanded,
        headerActions: <TrashHeaderActions />,
        children: <Trash />
      };
    }

    const result: SidebarSectionConfig[] = [];
    for (const key of mountedSectionKeys) {
      const config = byKey[key];
      if (config != null) {
        result.push(config);
      }
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
    mountedSectionKeys,
    openAddEnvironment,
    pluginSectionExpanded,
    pluginSidebarSections,
    runResultsSectionExpanded,
    searchActive,
    trashSectionExpanded,
    workspacesSectionExpanded,
    workflowsSectionExpanded,
    websitesSectionExpanded,
    liveServersSectionExpanded
  ]);

  const showPluginBody = activeRailItem != null || displayedPanel != null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar">
      {showSearch ? (
        <div className="shrink-0 border-b border-separator">
          <SidebarSearch value={searchQuery} onChange={setSearchQuery} loading={searchLoading} />
        </div>
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1">
        {showRail ? (
          <SidebarRail
            items={railItems}
            activeId={railActiveId}
            expanded={sidebarRailExpanded}
            onExpandedChange={setSidebarRailExpanded}
            onSelect={handleRailSelect}
            ariaLabel="Sidebar modes"
            panelId={SIDEBAR_RAIL_PANEL_ID}
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
          scroll={!showPluginBody}
          asideClassName="h-full min-h-0"
          bodyId={showRail ? SIDEBAR_RAIL_PANEL_ID : undefined}
          bodyRole={showRail ? 'tabpanel' : undefined}
          header={
            activeRailItem == null ? (
              <SidebarPanelSwitcher
                panels={switcherPanels}
                activePanelId={activePanelId}
                collectionsReplacement={collectionsReplacement}
                showSwitcher={showSwitcher}
              />
            ) : undefined
          }
          bodyClassName={showPluginBody ? 'px-2 py-2' : 'pb-3'}
        >
          {activeRailItem != null ? (
            <HostedSurface
              pluginId={activeRailItem.pluginId}
              contributionId={activeRailItem.contributionId}
              kind="sidebarRailItems"
              resizeMode="fill"
              className="h-full"
              context={sidebarPanelContext}
            />
          ) : displayedPanel != null ? (
            <HostedSurface
              pluginId={displayedPanel.pluginId}
              contributionId={displayedPanel.contributionId}
              kind="sidebarPanels"
              resizeMode="fill"
              className="h-full"
              context={sidebarPanelContext}
            />
          ) : (
            <SidebarSections sections={sections} expanded={expanded} onToggle={onToggle} />
          )}
        </Sidebar>
      </div>
    </div>
  );
}
