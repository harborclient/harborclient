import type { JSX } from 'react';
import type { PluginCatalogEntry } from '#/shared/plugin/catalog';
import type { PluginInfo, PluginGitPreview } from '#/shared/plugin/types';
import type { PluginManagementKind } from '#/renderer/src/ui/Plugins/constants';
import { findInstalledCatalogPlugin } from './helpers';
import { EnableModal } from './EnableModal';
import { PluginDetailModal } from './PluginDetailModal';
import { resolveCatalogPluginScreenshotSrcs } from './resolvePluginScreenshot';

interface Props {
  /**
   * Whether this screen shows plugins or themes.
   */
  kind: PluginManagementKind;

  /**
   * Installed plugin rows from the main process.
   */
  plugins: PluginInfo[];

  /**
   * Catalog listing shown in the marketplace detail modal, if any.
   */
  catalogDetailEntry: PluginCatalogEntry | null;

  /**
   * Remote manifest preview for the open catalog listing.
   */
  catalogPreview: PluginGitPreview | null;

  /**
   * Load state for the catalog manifest preview.
   */
  catalogPreviewLoadState: 'idle' | 'loading' | 'loaded' | 'error';

  /**
   * Preview fetch error message, if any.
   */
  catalogPreviewError: string | null;

  /**
   * Catalog listing id with an in-flight install/update action, if any.
   */
  catalogActionBusyId: string | null;

  /**
   * Closes the marketplace detail modal.
   */
  onCloseCatalogDetail: () => void;

  /**
   * Installs the open catalog listing.
   */
  onCatalogInstall: (entry: PluginCatalogEntry) => void;

  /**
   * Plugin id currently being updated from git, if any.
   */
  gitUpdateBusyId: string | null;

  /**
   * Toggles enablement for one plugin row.
   */
  onToggleEnabled: (plugin: PluginInfo) => void;

  /**
   * Reloads one unpacked plugin from disk.
   */
  onReload: (plugin: PluginInfo) => void;

  /**
   * Re-clones a git-installed plugin from its stored origin.
   */
  onUpdateFromGit: (pluginId: string) => void;

  /**
   * Removes an installed or unpacked plugin after confirmation.
   */
  onRemove: (plugin: PluginInfo) => void;

  /**
   * Plugin shown in the installed detail modal, if any.
   */
  detailPlugin: PluginInfo | null;

  /**
   * Loaded description markdown for the installed detail modal.
   */
  descriptionMarkdown: string;

  /**
   * Load state for the installed detail description markdown.
   */
  descriptionLoadState: 'idle' | 'loading' | 'loaded' | 'error';

  /**
   * Screenshot URLs for the installed detail modal.
   */
  detailScreenshotSrcs: string[];

  /**
   * Closes the installed detail modal.
   */
  onCloseDetail: () => void;

  /**
   * Plugin awaiting enable confirmation after install, if any.
   */
  pendingInstall: PluginInfo | null;

  /**
   * Rejects a pending install and removes the plugin.
   */
  onCancelPendingInstall: () => void;

  /**
   * Confirms a pending install and enables the plugin.
   */
  onConfirmPendingInstall: () => void;
}

/**
 * Renders plugin detail and enable-permission modals for the Plugins view.
 */
export function PluginModals({
  kind,
  plugins,
  catalogDetailEntry,
  catalogPreview,
  catalogPreviewLoadState,
  catalogPreviewError,
  catalogActionBusyId,
  onCloseCatalogDetail,
  onCatalogInstall,
  gitUpdateBusyId,
  onToggleEnabled,
  onReload,
  onUpdateFromGit,
  onRemove,
  detailPlugin,
  descriptionMarkdown,
  descriptionLoadState,
  detailScreenshotSrcs,
  onCloseDetail,
  pendingInstall,
  onCancelPendingInstall,
  onConfirmPendingInstall
}: Props): JSX.Element {
  const catalogInstalled = catalogDetailEntry
    ? findInstalledCatalogPlugin(plugins, catalogDetailEntry.id)
    : undefined;

  return (
    <>
      {catalogDetailEntry ? (
        <PluginDetailModal
          mode="catalog"
          kind={kind}
          entry={catalogDetailEntry}
          preview={catalogPreview}
          previewLoadState={catalogPreviewLoadState}
          previewError={catalogPreviewError}
          screenshotSrcs={resolveCatalogPluginScreenshotSrcs(catalogDetailEntry, catalogPreview)}
          installed={catalogInstalled}
          actionBusy={catalogActionBusyId === catalogDetailEntry.id}
          gitUpdateBusy={catalogInstalled != null && gitUpdateBusyId === catalogInstalled.id}
          onClose={onCloseCatalogDetail}
          onInstall={() => onCatalogInstall(catalogDetailEntry)}
          onToggleEnabled={onToggleEnabled}
          onReload={onReload}
          onUpdateFromGit={onUpdateFromGit}
          onRemove={onRemove}
        />
      ) : null}

      {detailPlugin ? (
        <PluginDetailModal
          mode="installed"
          kind={kind}
          plugin={detailPlugin}
          descriptionMarkdown={descriptionMarkdown}
          descriptionLoadState={descriptionLoadState}
          screenshotSrcs={detailScreenshotSrcs}
          gitUpdateBusy={gitUpdateBusyId === detailPlugin.id}
          onClose={onCloseDetail}
          onToggleEnabled={onToggleEnabled}
          onReload={onReload}
          onUpdateFromGit={onUpdateFromGit}
          onRemove={onRemove}
        />
      ) : null}

      {pendingInstall ? (
        <EnableModal
          plugin={pendingInstall}
          onCancel={onCancelPendingInstall}
          onConfirm={onConfirmPendingInstall}
        />
      ) : null}
    </>
  );
}
