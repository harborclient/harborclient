import { PageSidebar, SidebarLayout } from '@harborclient/sdk/components';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type JSX } from 'react';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  consumePendingInstalledSearch,
  consumePendingMarketplaceSearch,
  selectPendingInstalledSearch,
  selectPendingMarketplaceSearch
} from '#/renderer/src/store/slices/navigationSlice';
import { usePersistedPageSidebarSection } from '#/renderer/src/hooks/usePersistedPageSidebarSection';
import { pluginIsTheme } from '#/shared/plugin/themeCategory';
import { formatCustomThemeValue } from '#/shared/plugin/customThemeExport';
import type { PluginInfo } from '#/shared/plugin/types';
import type { CustomTheme } from '#/shared/types/customTheme';
import type { ThemeSource } from '#/shared/types';
import { applyPluginThemePreference } from '#/renderer/src/plugins/applyPluginTheme';
import { getRegisteredPluginThemes } from '#/renderer/src/plugins/registry';
import { applyThemePreference } from '#/renderer/src/plugins/themeRuntime';
import { syncThemeMenuNow } from '#/renderer/src/plugins/themeMenuSync';
import { formatErrorMessage, showAlert, showConfirm } from '#/renderer/src/ui/modals/dialogHelpers';
import { listPluginThemeVariants } from './listPluginThemeVariants';
import type { UseThemeVariantPickerState } from './PluginModals';
import { CustomThemeView } from './CustomThemeView';
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
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);
  const [customThemesLoading, setCustomThemesLoading] = useState(kind === 'themes');
  const [activeTheme, setActiveTheme] = useState<ThemeSource>('system');
  const [editingCustomThemeId, setEditingCustomThemeId] = useState<string | null>(null);
  const [useThemeVariantPicker, setUseThemeVariantPicker] =
    useState<UseThemeVariantPickerState | null>(null);

  /**
   * Loads saved custom themes for the Installed and Creator sections.
   */
  const loadCustomThemes = useCallback(async (): Promise<void> => {
    if (kind !== 'themes') {
      return;
    }
    setCustomThemesLoading(true);
    try {
      const themes = await window.api.listCustomThemes();
      setCustomThemes(themes);
      await syncThemeMenuNow();
    } finally {
      setCustomThemesLoading(false);
    }
  }, [kind]);

  /**
   * Loads custom themes and the active theme preference for the themes screen.
   */
  useEffect(() => {
    if (kind !== 'themes') {
      return;
    }

    let cancelled = false;

    void window.api
      .listCustomThemes()
      .then(async (themes) => {
        if (cancelled) {
          return;
        }
        setCustomThemes(themes);
        await syncThemeMenuNow();
      })
      .finally(() => {
        if (!cancelled) {
          setCustomThemesLoading(false);
        }
      });

    void window.api.getTheme().then((theme) => {
      if (!cancelled) {
        setActiveTheme(theme);
      }
    });

    const unsubscribe = window.api.onThemeChanged((theme) => {
      setActiveTheme(theme);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [kind]);

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
    kind,
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
    if (section === 'creator' && next !== 'creator') {
      setEditingCustomThemeId(null);
    }
    if (next === 'creator' && editingCustomThemeId == null && section !== 'creator') {
      setEditingCustomThemeId(null);
    }
    setSection(next);
    if (next === 'marketplace' && catalog == null && !catalogLoading) {
      void loadCatalog();
    }
    if (next === 'settings' && kind === 'plugins' && !pluginSourcesLoaded && !pluginSourcesBusy) {
      void loadPluginSources();
    }
  };

  /**
   * Applies one plugin theme variant and updates local active-theme state.
   *
   * @param pluginId - Plugin manifest id.
   * @param themeId - Theme id within the plugin manifest.
   */
  const handleApplyPluginTheme = useCallback(
    async (pluginId: string, themeId: string): Promise<void> => {
      try {
        await applyPluginThemePreference(pluginId, themeId);
        const theme = await window.api.getTheme();
        setActiveTheme(theme);
      } catch (err: unknown) {
        showAlert(dispatch, formatErrorMessage(err, 'Failed to switch theme'));
        throw err;
      }
    },
    [dispatch]
  );

  /**
   * Waits briefly for a newly enabled theme plugin to register its contributed themes.
   *
   * @param pluginId - Plugin manifest id to watch in the renderer registry.
   */
  const waitForRegisteredPluginThemes = useCallback(async (pluginId: string): Promise<void> => {
    for (let attempt = 0; attempt < 20; attempt++) {
      if (getRegisteredPluginThemes().some((entry) => entry.pluginId === pluginId)) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }, []);

  /**
   * Switches to a theme plugin from the Installed themes page, opening a variant picker
   * when the plugin contributes multiple themes.
   *
   * @param plugin - Installed theme plugin row.
   */
  const handleUsePluginTheme = useCallback(
    async (plugin: PluginInfo): Promise<void> => {
      if (kind !== 'themes') {
        return;
      }

      let currentPlugin = plugin;
      if (!plugin.enabled) {
        await window.api.setPluginEnabled(plugin.id, true);
        await refresh();
        await waitForRegisteredPluginThemes(plugin.id);
        currentPlugin = { ...plugin, enabled: true };
      }

      const variants = listPluginThemeVariants(currentPlugin, getRegisteredPluginThemes());
      if (variants.length === 0) {
        showAlert(dispatch, `No themes are available for ${plugin.name}.`);
        return;
      }

      if (variants.length === 1) {
        await handleApplyPluginTheme(plugin.id, variants[0].id);
        return;
      }

      setUseThemeVariantPicker({ plugin: currentPlugin, variants });
    },
    [kind, refresh, dispatch, handleApplyPluginTheme, waitForRegisteredPluginThemes]
  );

  /**
   * Applies the variant chosen in the multi-theme picker modal.
   *
   * @param themeId - Selected theme id within the plugin manifest.
   */
  const handleConfirmUseThemeVariant = useCallback(
    async (themeId: string): Promise<void> => {
      if (!useThemeVariantPicker) {
        return;
      }
      await handleApplyPluginTheme(useThemeVariantPicker.plugin.id, themeId);
      setUseThemeVariantPicker(null);
    },
    [useThemeVariantPicker, handleApplyPluginTheme]
  );

  /**
   * Opens one saved custom theme in the Creator section.
   *
   * @param id - Custom theme filename stem.
   */
  const handleEditCustomTheme = (id: string): void => {
    setEditingCustomThemeId(id);
    setSection('creator');
  };

  /**
   * Uninstalls one custom theme after confirmation and reverts the active theme when needed.
   *
   * @param theme - Custom theme to uninstall.
   */
  const handleDeleteCustomTheme = async (theme: CustomTheme): Promise<void> => {
    const confirmed = await showConfirm(dispatch, {
      title: 'Uninstall custom theme?',
      message: `Uninstall "${theme.title}"? This cannot be undone.`,
      confirmLabel: 'Uninstall',
      cancelLabel: 'Cancel',
      variant: 'danger'
    });
    if (!confirmed) {
      return;
    }

    await window.api.deleteCustomTheme(theme.id);
    const active = await window.api.getTheme();
    if (active === formatCustomThemeValue(theme.id)) {
      await window.api.setTheme('system');
      await applyThemePreference('system');
    }
    await loadCustomThemes();
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
            onUsePluginTheme={
              kind === 'themes' ? (plugin) => void handleUsePluginTheme(plugin) : undefined
            }
            customThemes={kind === 'themes' ? customThemes : undefined}
            customThemesLoading={kind === 'themes' ? customThemesLoading : undefined}
            activeTheme={kind === 'themes' ? activeTheme : undefined}
            onEditCustomTheme={kind === 'themes' ? handleEditCustomTheme : undefined}
            onDeleteCustomTheme={
              kind === 'themes' ? (theme) => void handleDeleteCustomTheme(theme) : undefined
            }
            onCustomThemesChanged={kind === 'themes' ? () => void loadCustomThemes() : undefined}
          />
        ) : null}
        {kind === 'themes' && section === 'creator' ? (
          <CustomThemeView
            key={editingCustomThemeId ?? 'new'}
            editingId={editingCustomThemeId}
            onSaved={(theme) => {
              void loadCustomThemes();
              setEditingCustomThemeId(theme.id);
            }}
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
        onUsePluginTheme={
          kind === 'themes' ? (plugin) => void handleUsePluginTheme(plugin) : undefined
        }
        useThemeVariantPicker={kind === 'themes' ? useThemeVariantPicker : null}
        onCloseUseThemeVariantPicker={() => setUseThemeVariantPicker(null)}
        onConfirmUseThemeVariant={(themeId) => handleConfirmUseThemeVariant(themeId)}
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
