import { PageSidebar, SidebarLayout } from '@harborclient/sdk/components';
import { useEffect, useState, type JSX } from 'react';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  consumePendingMarketplaceSearch,
  selectPendingMarketplaceSearch
} from '#/renderer/src/store/slices/navigationSlice';
import { InstalledView } from './InstalledView';
import { InstallView } from './InstallView';
import { MarketplaceView } from './MarketplaceView';
import { PluginModals } from './PluginModals';
import { PluginSourcesView } from './PluginSourcesView';
import { useCatalogDetailPreview } from './hooks/useCatalogDetailPreview';
import { usePluginCatalog } from './hooks/usePluginCatalog';
import { usePluginDeepLinkInstall } from './hooks/usePluginDeepLinkInstall';
import { usePluginDetail } from './hooks/usePluginDetail';
import { usePluginInstallActions } from './hooks/usePluginInstallActions';
import { usePluginList } from './hooks/usePluginList';
import { usePluginSources } from './hooks/usePluginSources';
import { PLUGIN_SECTIONS } from './sidebarConstants';
import type { PluginsSidebarSection } from './sidebarTypes';

/**
 * Full-area plugin management with sidebar navigation.
 */
export function Plugins(): JSX.Element {
  const dispatch = useAppDispatch();
  const pendingMarketplaceSearch = useAppSelector(selectPendingMarketplaceSearch);
  const [section, setSection] = useState<PluginsSidebarSection>('installed');

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
  } = usePluginCatalog();
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
    handleCatalogUpdate,
    handleLoadUnpacked,
    handleToggleEnabled,
    handleReload,
    handleRemove,
    handleRowKeyDown
  } = usePluginInstallActions({
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
   * Applies a marketplace search query queued by global search navigation.
   */
  useEffect(() => {
    if (pendingMarketplaceSearch == null) {
      return;
    }
    void loadCatalog().then(() => {
      setCatalogSearchQuery(pendingMarketplaceSearch);
      setSection('marketplace');
      dispatch(consumePendingMarketplaceSearch());
    });
  }, [dispatch, loadCatalog, pendingMarketplaceSearch, setCatalogSearchQuery]);

  const visibleSection: PluginsSidebarSection =
    pendingMarketplaceSearch != null ? 'marketplace' : section;

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
    if (next === 'settings' && !pluginSourcesLoaded && !pluginSourcesBusy) {
      void loadPluginSources();
    }
  };

  return (
    <>
      <SidebarLayout
        sidebar={
          <PageSidebar
            ariaLabel="Plugin sections"
            selected={visibleSection}
            onSelect={handleSectionChange}
            items={PLUGIN_SECTIONS}
          />
        }
      >
        {visibleSection === 'installed' ? (
          <InstalledView
            plugins={plugins}
            loading={loading}
            error={error}
            catalogById={catalogById}
            gitUpdateBusyId={gitUpdateBusyId}
            onOpenDetail={openDetail}
            onRowKeyDown={handleRowKeyDown}
            onToggleEnabled={(plugin) => void handleToggleEnabled(plugin)}
            onReload={(plugin) => void handleReload(plugin)}
            onUpdateFromGit={(pluginId) => void handleUpdateFromGit(pluginId)}
            onRemove={(plugin) => void handleRemove(plugin)}
          />
        ) : null}
        {visibleSection === 'marketplace' ? (
          <MarketplaceView
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
        {visibleSection === 'install' ? (
          <InstallView
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
        {visibleSection === 'settings' ? (
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
        plugins={plugins}
        catalogDetailEntry={catalogDetailEntry}
        catalogPreview={catalogPreview}
        catalogPreviewLoadState={catalogPreviewLoadState}
        catalogPreviewError={catalogPreviewError}
        catalogActionBusyId={catalogActionBusyId}
        onCloseCatalogDetail={closeCatalogDetail}
        onCatalogInstall={(entry) => void handleCatalogInstall(entry)}
        onCatalogUpdate={(pluginId) => void handleCatalogUpdate(pluginId)}
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
