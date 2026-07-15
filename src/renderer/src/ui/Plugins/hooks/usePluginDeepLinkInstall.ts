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
} from '#/renderer/src/ui/Modals/dialogHelpers';
import type { PluginManagementKind } from '../constants';
import { resolvePendingPluginInstallDeepLink } from '../helpers';
import type { PluginsSidebarSection } from '../sidebarTypes';

interface UsePluginDeepLinkInstallArgs {
  /**
   * Whether this screen manages plugins or themes.
   */
  kind: PluginManagementKind;

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
 * Handles harborclient:// plugin or theme install deep links queued in navigation state.
 */
export function usePluginDeepLinkInstall({
  kind,
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
  const isThemes = kind === 'themes';

  /**
   * Resolves a queued marketplace install deep link against the catalog.
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
              isThemes
                ? 'Could not load the theme marketplace.'
                : 'Could not load the plugin marketplace.'
            ),
            'Marketplace unavailable'
          );
          break;
        case 'not-found':
          showAlert(
            dispatch,
            isThemes
              ? `Theme "${pluginId}" was not found in the marketplace catalog.`
              : `Plugin "${pluginId}" was not found in the marketplace catalog.`,
            isThemes ? 'Theme not found' : 'Plugin not found'
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
            formatIpcErrorMessage(
              new Error(result.message),
              isThemes ? 'The theme could not be installed.' : 'The plugin could not be installed.'
            ),
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
    isThemes,
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
