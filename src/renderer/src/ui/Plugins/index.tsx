import { PageSidebar, SidebarLayout } from '@harborclient/sdk/components';
import { useCallback, useEffect, useLayoutEffect, useMemo, type JSX } from 'react';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  consumePendingInstalledSearch,
  consumePendingMarketplaceSearch,
  selectPendingInstalledSearch,
  selectPendingMarketplaceSearch
} from '#/renderer/src/store/slices/navigationSlice';
import { usePersistedPageSidebarSection } from '#/renderer/src/hooks/usePersistedPageSidebarSection';
import { pluginIsTheme } from '#/shared/plugin/themeCategory';
import { InstalledView } from './InstalledView';
import { InstallView } from './InstallView';
import { MarketplaceView } from './MarketplaceView';
import { PluginModals } from './PluginModals';
import { PluginSourcesView } from './PluginSourcesView';
import type { PluginManagementKind } from './constants';
import { useCatalogDetailPreview } from './hooks/useCatalogDetailPreview';
import { useInstalledPluginSearch } from './hooks/useInstalledPluginSearch';
import { usePluginCatalog } from './hooks/usePluginCatalog';
import { usePluginDeepLinkInstall } from './hooks/usePluginDeepLinkInstall';
import { usePluginDetail } from './hooks/usePluginDetail';
import { usePluginInstallActions } from './hooks/usePluginInstallActions';
import { usePluginList } from './hooks/usePluginList';
import { usePluginSources } from './hooks/usePluginSources';
import { pluginSidebarSections } from './sidebarConstants';
import type { PluginsSidebarSection } from './sidebarTypes';

interface Props {
  /**
   * Whether this screen manages plugins or themes.
   */
  kind?: PluginManagementKind;
}

/**
 * Full-area plugin or theme management with sidebar navigation.
 */
export function Plugins({ kind = 'plugins' }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const pendingMarketplaceSearch = useAppSelector(selectPendingMarketplaceSearch);
  const pendingInstalledSearch = useAppSelector(selectPendingInstalledSearch);
  const pageKey = kind === 'themes' ? 'themes' : 'plugins';

  /**
   * Sidebar entries for the active management kind (themes omit Settings).
   */
  const sidebarItems = useMemo(() => pluginSidebarSections(kind), [kind]);

  /**
   * Validates sidebar section ids for the active plugin management kind.
   */
  const isValidSection = useCallback(
    (candidate: string): candidate is PluginsSidebarSection =>
      sidebarItems.some((entry) => entry.value === candidate),
    [sidebarItems]
  );

  /**
   * Sidebar section queued by Search Anything until the local search field applies it.
   */
  const navigationOverride = useMemo((): PluginsSidebarSection | undefined => {
    if (pendingMarketplaceSearch != null) {
      return 'marketplace';
    }
    if (pendingInstalledSearch != null) {
      return 'installed';
    }
    return undefined;
  }, [pendingInstalledSearch, pendingMarketplaceSearch]);

  const { section, setSection } = usePersistedPageSidebarSection<PluginsSidebarSection>({
    pageKey,
    defaultSection: 'installed',
    isValidSection,
    navigationOverride
  });

  const { plugins, loading, error, refresh } = usePluginList();
  const {
    catalog,
    setCatalog,
    catalogLoading,
    setCatalogLoading,
    catalogError,
    setCatalogError,
    catalogById,
    catalogSearchQuery,
    setCatalogSearchQuery,
    catalogCategoryFilter,
    setCatalogCategoryFilter,
    filteredCatalogPlugins,
    loadCatalog,
    resetCatalogFilters
  } = usePluginCatalog(kind);
  const {
    detailPlugin,
    descriptionMarkdown,
    descriptionLoadState,
    detailScreenshotSrcs,
    openDetail,
    closeDetail
  } = usePluginDetail({ plugins, catalogById });
  const {
    catalogDetailEntry,
    catalogPreview,
    catalogPreviewLoadState,
    catalogPreviewError,
    openCatalogDetail,
    closeCatalogDetail,
    resetCatalogDetail,
    closeCatalogDetailAfterInstall
  } = useCatalogDetailPreview({ plugins, openDetail, setCatalogError });
  const {
    pendingInstall,
    setPendingInstall,
    closePendingInstall,
    gitInstallUrl,
    gitInstallRef,
    gitInstallError,
    gitInstallBusy,
    gitUpdateBusyId,
    catalogActionBusyId,
    setCatalogActionBusyId,
    onGitInstallUrlChange,
    onGitInstallRefChange,
    handleInstallFromFile,
    handleInstallFromGit,
    handleUpdateFromGit,
    handleCatalogInstall,
    handleLoadUnpacked,
    handleToggleEnabled,
    handleReload,
    handleRemove
  } = usePluginInstallActions({
    kind,
    refresh,
    openDetail,
    detailPlugin,
    closeDetail,
    closeCatalogDetailAfterInstall
  });
  const {
    pluginSourcesDraft,
    pluginSourcesBusy,
    pluginSourcesLoadError,
    pluginSourcesLoaded,
    teamHubPluginSources,
    loadPluginSources,
    resetPluginSourcesDraft,
    updatePluginSourceDraft,
    removePluginSourceDraft,
    addPluginSourceDraft,
    savePluginSources
  } = usePluginSources({ activeSection: section, setCatalog, loadCatalog });

  usePluginDeepLinkInstall({
    setSection,
    setCatalog,
    setCatalogLoading,
    setCatalogError,
    setCatalogActionBusyId,
    openDetail,
    setPendingInstall
  });

  /**
   * Installed rows visible on this tab after filtering by plugin vs theme kind.
   */
  const visibleInstalledPlugins = useMemo(() => {
    if (kind === 'themes') {
      return plugins.filter(pluginIsTheme);
    }
    return plugins.filter((plugin) => !pluginIsTheme(plugin));
  }, [plugins, kind]);

  const {
    searchQuery: installedSearchQuery,
    setSearchQuery: setInstalledSearchQuery,
    filteredPlugins: filteredInstalledPlugins
  } = useInstalledPluginSearch(visibleInstalledPlugins);

  /**
   * Applies a marketplace search query queued by global search navigation before paint.
   */
  useLayoutEffect(() => {
    if (pendingMarketplaceSearch == null) {
      return;
    }
    setCatalogSearchQuery(pendingMarketplaceSearch);
    setSection('marketplace');
  }, [pendingMarketplaceSearch, setCatalogSearchQuery, setSection]);

  /**
   * Loads section-specific data when the sidebar section is restored from memory
   * or navigation without passing through handleSectionChange.
   */
  useEffect(() => {
    if (section === 'marketplace' && catalog == null && !catalogLoading) {
      void loadCatalog();
    }
    if (
      section === 'settings' &&
      kind === 'plugins' &&
      !pluginSourcesLoaded &&
      !pluginSourcesBusy
    ) {
      void loadPluginSources();
    }
  }, [
    section,
    kind,
    catalog,
    catalogLoading,
    loadCatalog,
    pluginSourcesLoaded,
    pluginSourcesBusy,
    loadPluginSources
  ]);

  /**
   * Clears marketplace search navigation after the query is applied locally.
   */
  useEffect(() => {
    if (pendingMarketplaceSearch == null) {
      return;
    }
    if (catalogSearchQuery.trim() !== pendingMarketplaceSearch.trim()) {
      return;
    }
    dispatch(consumePendingMarketplaceSearch());
  }, [catalogSearchQuery, dispatch, pendingMarketplaceSearch]);

  /**
   * Applies an installed search query queued by global search navigation before paint.
   */
  useLayoutEffect(() => {
    if (pendingInstalledSearch == null) {
      return;
    }
    setInstalledSearchQuery(pendingInstalledSearch);
    setSection('installed');
  }, [pendingInstalledSearch, setInstalledSearchQuery, setSection]);

  /**
   * Clears installed search navigation after the query is applied locally.
   */
  useEffect(() => {
    if (pendingInstalledSearch == null) {
      return;
    }
    if (installedSearchQuery.trim() !== pendingInstalledSearch.trim()) {
      return;
    }
    dispatch(consumePendingInstalledSearch());
  }, [dispatch, installedSearchQuery, pendingInstalledSearch]);

  /**
   * Clears marketplace filters when leaving the Marketplace section and loads
   * section-specific data when entering Marketplace or Settings.
   *
   * @param next - Sidebar section to show.
   */
  const handleSectionChange = (next: PluginsSidebarSection): void => {
    if (section === 'marketplace' && next !== 'marketplace') {
      resetCatalogDetail();
      resetCatalogFilters();
    }
    setSection(next);
    if (next === 'marketplace' && catalog == null && !catalogLoading) {
      void loadCatalog();
    }
    if (next === 'settings' && kind === 'plugins' && !pluginSourcesLoaded && !pluginSourcesBusy) {
      void loadPluginSources();
    }
  };

  const sidebarAriaLabel = kind === 'themes' ? 'Theme sections' : 'Plugin sections';

  return (
    <>
      <SidebarLayout
        sidebar={
          <PageSidebar
            ariaLabel={sidebarAriaLabel}
            selected={section}
            onSelect={handleSectionChange}
            items={sidebarItems}
          />
        }
      >
        {section === 'installed' ? (
          <InstalledView
            kind={kind}
            plugins={visibleInstalledPlugins}
            filteredPlugins={filteredInstalledPlugins}
            searchQuery={installedSearchQuery}
            onSearchQueryChange={setInstalledSearchQuery}
            loading={loading}
            error={error}
            catalogById={catalogById}
            gitUpdateBusyId={gitUpdateBusyId}
            onOpenDetail={openDetail}
            onToggleEnabled={(plugin) => void handleToggleEnabled(plugin)}
            onReload={(plugin) => void handleReload(plugin)}
            onUpdateFromGit={(pluginId) => void handleUpdateFromGit(pluginId)}
            onRemove={(plugin) => void handleRemove(plugin)}
          />
        ) : null}
        {section === 'marketplace' ? (
          <MarketplaceView
            kind={kind}
            catalog={catalog}
            catalogLoading={catalogLoading}
            catalogError={catalogError}
            catalogSearchQuery={catalogSearchQuery}
            catalogCategoryFilter={catalogCategoryFilter}
            filteredCatalogPlugins={filteredCatalogPlugins}
            onSearchQueryChange={setCatalogSearchQuery}
            onCategoryFilterChange={setCatalogCategoryFilter}
            onOpenCatalogDetail={openCatalogDetail}
          />
        ) : null}
        {section === 'install' ? (
          <InstallView
            kind={kind}
            gitInstallUrl={gitInstallUrl}
            gitInstallRef={gitInstallRef}
            gitInstallError={gitInstallError}
            gitInstallBusy={gitInstallBusy}
            onGitInstallUrlChange={onGitInstallUrlChange}
            onGitInstallRefChange={onGitInstallRefChange}
            onInstallFromFile={() => void handleInstallFromFile()}
            onLoadUnpacked={() => void handleLoadUnpacked()}
            onInstallFromGit={() => void handleInstallFromGit()}
          />
        ) : null}
        {kind === 'plugins' && section === 'settings' ? (
          <PluginSourcesView
            settings={pluginSourcesDraft}
            hubSources={teamHubPluginSources}
            busy={pluginSourcesBusy}
            error={pluginSourcesLoadError}
            onSave={() => void savePluginSources()}
            onResetDefaults={resetPluginSourcesDraft}
            onUpdateSource={updatePluginSourceDraft}
            onRemoveSource={removePluginSourceDraft}
            onAddSource={addPluginSourceDraft}
          />
        ) : null}
      </SidebarLayout>

      <PluginModals
        kind={kind}
        plugins={plugins}
        catalogDetailEntry={catalogDetailEntry}
        catalogPreview={catalogPreview}
        catalogPreviewLoadState={catalogPreviewLoadState}
        catalogPreviewError={catalogPreviewError}
        catalogActionBusyId={catalogActionBusyId}
        onCloseCatalogDetail={closeCatalogDetail}
        onCatalogInstall={(entry) => void handleCatalogInstall(entry)}
        gitUpdateBusyId={gitUpdateBusyId}
        onToggleEnabled={(plugin) => void handleToggleEnabled(plugin)}
        onReload={(plugin) => void handleReload(plugin)}
        onUpdateFromGit={(pluginId) => void handleUpdateFromGit(pluginId)}
        onRemove={(plugin) => void handleRemove(plugin)}
        detailPlugin={detailPlugin}
        descriptionMarkdown={descriptionMarkdown}
        descriptionLoadState={descriptionLoadState}
        detailScreenshotSrcs={detailScreenshotSrcs}
        onCloseDetail={closeDetail}
        pendingInstall={pendingInstall}
        onCancelPendingInstall={() => void closePendingInstall(false)}
        onConfirmPendingInstall={() => void closePendingInstall(true)}
      />
    </>
  );
}
