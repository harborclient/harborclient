import { Page, Spinner } from '@harborclient/sdk/components';
import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import type { PageRef } from '#/renderer/src/store/drafts';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { closeTab } from '#/renderer/src/store/slices/tabsSlice';
import { applyPluginThemePreference } from '#/renderer/src/plugins/applyPluginTheme';
import { getRegisteredPluginThemes } from '#/renderer/src/plugins/registry';
import type { PluginInfo } from '#/shared/plugin/types';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/Modals/dialogHelpers';
import { faPalette, faPuzzlePiece } from '#/renderer/src/fontawesome';
import { listPluginThemeVariants } from './listPluginThemeVariants';
import { EnableModal } from './EnableModal';
import { PluginDetailActions } from './PluginDetailActions';
import { PluginDetailContent } from './PluginDetailContent';
import type { UseThemeVariantPickerState } from './PluginModals';
import { UseThemeVariantModal } from './UseThemeVariantModal';
import { findInstalledCatalogPlugin } from './helpers';
import { useCatalogDetailPreview } from './hooks/useCatalogDetailPreview';
import { usePluginCatalog } from './hooks/usePluginCatalog';
import { usePluginDetail } from './hooks/usePluginDetail';
import { usePluginInstallActions } from './hooks/usePluginInstallActions';
import { usePluginList } from './hooks/usePluginList';
import { resolveCatalogPluginScreenshotSrcs } from './resolvePluginScreenshot';

interface Props {
  /**
   * Plugin or theme detail tab identity.
   */
  page: Extract<PageRef, { type: 'plugin-detail' }>;

  /**
   * Tab id hosting this page.
   */
  tabId: string;
}

/**
 * Renders installed or marketplace plugin/theme detail inside a page tab.
 */
export function PluginDetailPage({ page, tabId }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const { plugins, loading, refresh } = usePluginList();
  const { catalogById, catalogLoading, catalogError, setCatalogError, loadCatalog } =
    usePluginCatalog(page.kind);
  const {
    detailPlugin,
    descriptionMarkdown,
    descriptionLoadState,
    detailScreenshotSrcs,
    openDetail
  } = usePluginDetail({ plugins, catalogById });
  const {
    catalogDetailEntry,
    catalogPreview,
    catalogPreviewLoadState,
    catalogPreviewError,
    openCatalogDetail,
    closeCatalogDetail
  } = useCatalogDetailPreview({ plugins, openDetail, setCatalogError });
  const [useThemeVariantPicker, setUseThemeVariantPicker] =
    useState<UseThemeVariantPickerState | null>(null);

  /**
   * Closes this detail tab.
   */
  const handleCloseTab = useCallback((): void => {
    dispatch(closeTab(tabId));
  }, [dispatch, tabId]);

  const {
    pendingInstall,
    closePendingInstall,
    gitUpdateBusyId,
    catalogActionBusyId,
    handleToggleEnabled,
    handleReload,
    handleRemove,
    handleUpdateFromGit,
    handleCatalogInstall
  } = usePluginInstallActions({
    kind: page.kind,
    refresh,
    openDetail,
    detailPlugin,
    closeDetail: handleCloseTab,
    closeCatalogDetailAfterInstall: closeCatalogDetail
  });

  /**
   * Loads marketplace catalog data when this tab shows a catalog listing.
   */
  useEffect(() => {
    if (page.source !== 'catalog') {
      return;
    }
    if (catalogById.size === 0 && !catalogLoading) {
      void loadCatalog();
    }
  }, [page.source, catalogById.size, catalogLoading, loadCatalog]);

  /**
   * Opens installed plugin detail state when the backing row is available.
   */
  useEffect(() => {
    const catalogEntry =
      page.source === 'catalog' ? (catalogById.get(page.id) ?? catalogDetailEntry) : null;
    const installedFromCatalog = catalogEntry
      ? findInstalledCatalogPlugin(plugins, catalogEntry.id)
      : undefined;
    const plugin =
      page.source === 'installed'
        ? plugins.find((entry) => entry.id === page.id)
        : installedFromCatalog;

    if (plugin) {
      openDetail(plugin);
    }
  }, [page.source, page.id, plugins, catalogById, catalogDetailEntry, openDetail]);

  /**
   * Closes the tab when an installed plugin row disappears.
   */
  useEffect(() => {
    if (page.source !== 'installed' || loading) {
      return;
    }
    if (!plugins.some((entry) => entry.id === page.id)) {
      dispatch(closeTab(tabId));
    }
  }, [page.source, page.id, plugins, loading, dispatch, tabId]);

  /**
   * Opens marketplace preview state when the catalog listing is available.
   */
  useEffect(() => {
    if (page.source !== 'catalog') {
      return;
    }
    const entry = catalogById.get(page.id);
    if (entry) {
      openCatalogDetail(entry);
    }
  }, [page.source, page.id, catalogById, openCatalogDetail]);

  /**
   * Closes the tab when a marketplace listing cannot be resolved after catalog load.
   */
  useEffect(() => {
    if (page.source !== 'catalog' || catalogLoading) {
      return;
    }
    if (catalogById.size > 0 && !catalogById.has(page.id)) {
      dispatch(closeTab(tabId));
    }
  }, [page.source, page.id, catalogById, catalogLoading, dispatch, tabId]);

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
        await window.api.getTheme();
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
   * Switches to a theme plugin, opening a variant picker when multiple themes exist.
   *
   * @param plugin - Installed theme plugin row.
   */
  const handleUsePluginTheme = useCallback(
    async (plugin: PluginInfo): Promise<void> => {
      if (page.kind !== 'themes') {
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
    [page.kind, refresh, dispatch, handleApplyPluginTheme, waitForRegisteredPluginThemes]
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

  const catalogEntry =
    page.source === 'catalog' ? (catalogById.get(page.id) ?? catalogDetailEntry) : null;
  const installedFromCatalog = catalogEntry
    ? findInstalledCatalogPlugin(plugins, catalogEntry.id)
    : undefined;
  const installedPlugin =
    page.source === 'installed' ? detailPlugin : (installedFromCatalog ?? undefined);

  const pageIcon = page.kind === 'themes' ? faPalette : faPuzzlePiece;
  const isLoading =
    (page.source === 'installed' && loading) ||
    (page.source === 'catalog' && catalogLoading && !catalogEntry);

  const content = useMemo((): JSX.Element | null => {
    if (installedPlugin) {
      return (
        <PluginDetailContent
          mode="installed"
          plugin={installedPlugin}
          descriptionMarkdown={descriptionMarkdown}
          descriptionLoadState={descriptionLoadState}
          screenshotSrcs={detailScreenshotSrcs}
        />
      );
    }

    if (catalogEntry) {
      return (
        <PluginDetailContent
          mode="catalog"
          entry={catalogEntry}
          preview={catalogPreview}
          previewLoadState={catalogPreviewLoadState}
          previewError={catalogPreviewError}
          screenshotSrcs={resolveCatalogPluginScreenshotSrcs(catalogEntry, catalogPreview)}
          installed={installedFromCatalog}
        />
      );
    }

    return null;
  }, [
    installedPlugin,
    descriptionMarkdown,
    descriptionLoadState,
    detailScreenshotSrcs,
    catalogEntry,
    catalogPreview,
    catalogPreviewLoadState,
    catalogPreviewError,
    installedFromCatalog
  ]);

  const headerActions = useMemo((): JSX.Element | null => {
    if (installedPlugin) {
      return (
        <PluginDetailActions
          mode="installed"
          kind={page.kind}
          plugin={installedPlugin}
          gitUpdateBusy={gitUpdateBusyId === installedPlugin.id}
          onToggleEnabled={(plugin) => void handleToggleEnabled(plugin)}
          onReload={(plugin) => void handleReload(plugin)}
          onUpdateFromGit={(pluginId) => void handleUpdateFromGit(pluginId)}
          onRemove={(plugin) => void handleRemove(plugin)}
          onUseTheme={
            page.kind === 'themes' ? (plugin) => void handleUsePluginTheme(plugin) : undefined
          }
        />
      );
    }

    if (catalogEntry) {
      return (
        <PluginDetailActions
          mode="catalog"
          kind={page.kind}
          entry={catalogEntry}
          actionBusy={catalogActionBusyId === catalogEntry.id}
          gitUpdateBusy={false}
          onInstall={() => void handleCatalogInstall(catalogEntry)}
          onToggleEnabled={(plugin) => void handleToggleEnabled(plugin)}
          onReload={(plugin) => void handleReload(plugin)}
          onUpdateFromGit={(pluginId) => void handleUpdateFromGit(pluginId)}
          onRemove={(plugin) => void handleRemove(plugin)}
        />
      );
    }

    return null;
  }, [
    installedPlugin,
    page.kind,
    gitUpdateBusyId,
    handleToggleEnabled,
    handleReload,
    handleUpdateFromGit,
    handleRemove,
    handleUsePluginTheme,
    catalogEntry,
    catalogActionBusyId,
    handleCatalogInstall
  ]);

  return (
    <>
      <Page
        embedded
        title={page.label}
        icon={pageIcon}
        className="flex min-h-0 flex-1 flex-col overflow-hidden p-6 pt-0!"
        actions={
          headerActions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{headerActions}</div>
          ) : undefined
        }
      >
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted" role="status">
            <Spinner size="sm" />
            <span>Loading…</span>
          </div>
        ) : catalogError && page.source === 'catalog' ? (
          <p className="m-0 text-danger" role="alert">
            {catalogError}
          </p>
        ) : (
          content
        )}
      </Page>

      {useThemeVariantPicker ? (
        <UseThemeVariantModal
          plugin={useThemeVariantPicker.plugin}
          variants={useThemeVariantPicker.variants}
          onCancel={() => setUseThemeVariantPicker(null)}
          onConfirm={(themeId) => void handleConfirmUseThemeVariant(themeId)}
        />
      ) : null}

      {pendingInstall ? (
        <EnableModal
          plugin={pendingInstall}
          onCancel={() => void closePendingInstall(false)}
          onConfirm={() => void closePendingInstall(true)}
        />
      ) : null}
    </>
  );
}
