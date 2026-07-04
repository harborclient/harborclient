import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { PluginCatalog } from '#/shared/plugin/catalog';
import type { PluginInfo } from '#/shared/plugin/types';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  consumePendingPluginInstall,
  selectPendingPluginInstallId
} from '#/renderer/src/store/slices/navigationSlice';
import {
  showAlert,
  showConfirm,
  formatIpcErrorMessage
} from '#/renderer/src/ui/modals/dialogHelpers';
import { resolvePendingPluginInstallDeepLink } from '../helpers';
import type { PluginsSidebarSection } from '../sidebarTypes';

interface UsePluginDeepLinkInstallArgs {
  /**
   * Switches the active sidebar section.
   */
  setSection: (section: PluginsSidebarSection) => void;

  /**
   * Replaces the loaded marketplace catalog.
   */
  setCatalog: Dispatch<SetStateAction<PluginCatalog | null>>;

  /**
   * Sets marketplace catalog loading state.
   */
  setCatalogLoading: Dispatch<SetStateAction<boolean>>;

  /**
   * Sets marketplace catalog error state.
   */
  setCatalogError: Dispatch<SetStateAction<string | null>>;

  /**
   * Sets the catalog action busy id during deep-link installs.
   */
  setCatalogActionBusyId: Dispatch<SetStateAction<string | null>>;

  /**
   * Opens the installed plugin detail modal.
   */
  openDetail: (plugin: PluginInfo) => void;

  /**
   * Queues the enable-permissions modal for a newly installed plugin.
   */
  setPendingInstall: Dispatch<SetStateAction<PluginInfo | null>>;
}

/**
 * Handles harborclient:// plugin install deep links queued in navigation state.
 */
export function usePluginDeepLinkInstall({
  setSection,
  setCatalog,
  setCatalogLoading,
  setCatalogError,
  setCatalogActionBusyId,
  openDetail,
  setPendingInstall
}: UsePluginDeepLinkInstallArgs): void {
  const dispatch = useAppDispatch();
  const pendingPluginInstallId = useAppSelector(selectPendingPluginInstallId);

  /**
   * Resolves a queued plugin install deep link against the marketplace catalog.
   */
  useEffect(() => {
    if (!pendingPluginInstallId) {
      return;
    }

    const pluginId = pendingPluginInstallId;
    let cancelled = false;

    const run = async (): Promise<void> => {
      setSection('marketplace');
      setCatalogLoading(true);
      setCatalogError(null);

      const result = await resolvePendingPluginInstallDeepLink(pluginId, {
        getPluginCatalog: async () => {
          const loaded = await window.api.getPluginCatalog();
          if (!cancelled) {
            setCatalog(loaded);
          }
          return loaded;
        },
        listPlugins: () => window.api.listPlugins(),
        confirmInstall: (entry) =>
          showConfirm(dispatch, {
            title: `Install ${entry.name}?`,
            message: `Install ${entry.name} v${entry.version} by ${entry.author} from ${entry.repoUrl}?`,
            confirmLabel: 'Install'
          }),
        installFromGit: async (entry) => {
          setCatalogActionBusyId(entry.id);
          try {
            return await window.api.installPluginFromGit(entry.repoUrl, entry.ref);
          } finally {
            if (!cancelled) {
              setCatalogActionBusyId(null);
            }
          }
        },
        isCancelled: () => cancelled
      });

      if (cancelled) {
        return;
      }

      setCatalogLoading(false);
      dispatch(consumePendingPluginInstall());

      switch (result.kind) {
        case 'catalog-error':
          showAlert(
            dispatch,
            formatIpcErrorMessage(
              new Error(result.message),
              'Could not load the plugin marketplace.'
            ),
            'Marketplace unavailable'
          );
          break;
        case 'not-found':
          showAlert(
            dispatch,
            `Plugin "${pluginId}" was not found in the marketplace catalog.`,
            'Plugin not found'
          );
          break;
        case 'already-installed':
          openDetail(result.plugin);
          break;
        case 'installed':
          setPendingInstall(result.plugin);
          break;
        case 'install-error':
          showAlert(
            dispatch,
            formatIpcErrorMessage(new Error(result.message), 'The plugin could not be installed.'),
            'Install failed',
            { icon: 'warning' }
          );
          break;
        case 'declined':
        case 'cancelled':
          break;
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    pendingPluginInstallId,
    dispatch,
    setSection,
    setCatalog,
    setCatalogLoading,
    setCatalogError,
    setCatalogActionBusyId,
    openDetail,
    setPendingInstall
  ]);
}
