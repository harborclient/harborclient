import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import toast from 'react-hot-toast';
import type { PluginCatalogEntry } from '#/shared/plugin/catalog';
import type { PluginInfo } from '#/shared/plugin/types';
import { pluginIsTheme, formatThemeDisplayName } from '#/shared/plugin/themeCategory';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import type { PluginManagementKind } from '#/renderer/src/ui/Tabs/Plugins/constants';
import {
  showAlert,
  showConfirm,
  formatIpcErrorMessage
} from '#/renderer/src/ui/Modals/dialogHelpers';
import { isManagedInstall, queueThemePromptIfNeeded } from '../helpers';

interface UsePluginInstallActionsArgs {
  /**
   * Whether installs are scoped to plugins or themes.
   */
  kind: PluginManagementKind;

  /**
   * Reloads the installed plugin list from the main process.
   */
  refresh: () => Promise<PluginInfo[]>;

  /**
   * Opens the installed plugin detail modal.
   */
  openDetail: (plugin: PluginInfo) => void;

  /**
   * Plugin currently shown in the installed detail modal, if any.
   */
  detailPlugin: PluginInfo | null;

  /**
   * Closes the installed plugin detail modal.
   */
  closeDetail: () => void;

  /**
   * Closes the catalog detail modal after a successful install.
   */
  closeCatalogDetailAfterInstall: () => void;
}

interface UsePluginInstallActionsResult {
  /**
   * Plugin awaiting enable confirmation after install, if any.
   */
  pendingInstall: PluginInfo | null;

  /**
   * Sets the pending install plugin (used by deep links).
   */
  setPendingInstall: Dispatch<SetStateAction<PluginInfo | null>>;

  /**
   * Closes the permissions dialog and optionally removes a just-installed plugin.
   */
  closePendingInstall: (keep: boolean) => Promise<void>;

  /**
   * Repository URL entered for git install.
   */
  gitInstallUrl: string;

  /**
   * Optional git branch or tag for git install.
   */
  gitInstallRef: string;

  /**
   * Validation or IPC error for git install.
   */
  gitInstallError: string | null;

  /**
   * Whether a git clone is in progress.
   */
  gitInstallBusy: boolean;

  /**
   * Plugin id currently being updated from git, if any.
   */
  gitUpdateBusyId: string | null;

  /**
   * Catalog listing id with an in-flight install/update action, if any.
   */
  catalogActionBusyId: string | null;

  /**
   * Sets the catalog action busy id (used by deep links).
   */
  setCatalogActionBusyId: Dispatch<SetStateAction<string | null>>;

  /**
   * Updates the git install URL field.
   */
  onGitInstallUrlChange: (url: string) => void;

  /**
   * Updates the git install ref field.
   */
  onGitInstallRefChange: (ref: string) => void;

  /**
   * Opens the install-from-file dialog.
   */
  handleInstallFromFile: () => Promise<void>;

  /**
   * Clones a plugin from a public git repository URL.
   */
  handleInstallFromGit: () => Promise<void>;

  /**
   * Re-clones a git-installed plugin from its stored origin.
   */
  handleUpdateFromGit: (pluginId: string) => Promise<void>;

  /**
   * Installs a marketplace plugin via the git clone flow.
   */
  handleCatalogInstall: (entry: PluginCatalogEntry) => Promise<void>;

  /**
   * Opens the load-unpacked dialog.
   */
  handleLoadUnpacked: () => Promise<void>;

  /**
   * Toggles enablement for one plugin row.
   */
  handleToggleEnabled: (plugin: PluginInfo) => Promise<void>;

  /**
   * Reloads one unpacked plugin from disk.
   */
  handleReload: (plugin: PluginInfo) => Promise<void>;

  /**
   * Removes an installed or unpacked plugin after confirmation.
   */
  handleRemove: (plugin: PluginInfo) => Promise<void>;
}

/**
 * Manages plugin install, update, enable, and removal actions across Installed and Marketplace views.
 */
export function usePluginInstallActions({
  kind,
  refresh,
  openDetail,
  detailPlugin,
  closeDetail,
  closeCatalogDetailAfterInstall
}: UsePluginInstallActionsArgs): UsePluginInstallActionsResult {
  const dispatch = useAppDispatch();
  const [pendingInstall, setPendingInstall] = useState<PluginInfo | null>(null);
  const [gitInstallUrl, setGitInstallUrl] = useState('');
  const [gitInstallRef, setGitInstallRef] = useState('');
  const [gitInstallError, setGitInstallError] = useState<string | null>(null);
  const [gitInstallBusy, setGitInstallBusy] = useState(false);
  const [gitUpdateBusyId, setGitUpdateBusyId] = useState<string | null>(null);
  const [catalogActionBusyId, setCatalogActionBusyId] = useState<string | null>(null);

  /**
   * Shows a blocking alert when a user-initiated plugin action fails.
   *
   * @param title - Dialog heading.
   * @param err - Caught error from the IPC call.
   * @param fallback - Message when the error cannot be parsed.
   */
  const showPluginActionError = useCallback(
    (title: string, err: unknown, fallback: string): void => {
      showAlert(dispatch, formatIpcErrorMessage(err, fallback), title, { icon: 'warning' });
    },
    [dispatch]
  );

  /**
   * Closes the permissions dialog and optionally removes a just-installed plugin.
   *
   * @param keep - When false, uninstall/remove the pending plugin.
   */
  const closePendingInstall = useCallback(
    async (keep: boolean): Promise<void> => {
      if (!pendingInstall) {
        return;
      }
      const plugin = pendingInstall;
      setPendingInstall(null);
      if (!keep) {
        if (isManagedInstall(plugin)) {
          await window.api.uninstallPlugin(plugin.id);
        } else {
          await window.api.removeUnpackedPlugin(plugin.id);
        }
        await refresh();
        return;
      }
      queueThemePromptIfNeeded(plugin);
      await window.api.setPluginEnabled(plugin.id, true);
      const next = await refresh();
      const enabled = next.find((entry) => entry.id === plugin.id);
      if (enabled) {
        openDetail(enabled);
      }
    },
    [pendingInstall, refresh, openDetail]
  );

  /**
   * Returns whether an installed plugin matches the active management kind.
   *
   * @param plugin - Newly installed plugin metadata.
   * @returns True when the plugin belongs on the current tab.
   */
  const pluginMatchesKind = useCallback(
    (plugin: PluginInfo): boolean => {
      const isTheme = pluginIsTheme(plugin);
      return kind === 'themes' ? isTheme : !isTheme;
    },
    [kind]
  );

  /**
   * Explains why a plugin cannot be installed from the current tab.
   */
  const wrongKindInstallMessage = useCallback((): string => {
    if (kind === 'themes') {
      return 'This is a plugin, not a theme. Install it from the Plugins tab.';
    }
    return 'This is a theme. Install it from the Themes tab.';
  }, [kind]);

  /**
   * Rolls back an install when the package kind does not match the active tab.
   *
   * @param plugin - Plugin that was just installed.
   * @returns True when the install was rejected and rolled back.
   */
  const rejectWrongKindInstall = useCallback(
    async (plugin: PluginInfo): Promise<boolean> => {
      if (pluginMatchesKind(plugin)) {
        return false;
      }

      if (isManagedInstall(plugin)) {
        await window.api.uninstallPlugin(plugin.id);
      } else {
        await window.api.removeUnpackedPlugin(plugin.id);
      }
      await refresh();
      showAlert(dispatch, wrongKindInstallMessage(), 'Wrong tab', { icon: 'warning' });
      return true;
    },
    [dispatch, pluginMatchesKind, refresh, wrongKindInstallMessage]
  );

  /**
   * Opens the install-from-file dialog and shows the permissions modal.
   */
  const handleInstallFromFile = useCallback(async (): Promise<void> => {
    try {
      const installed = await window.api.installPlugin();
      if (installed) {
        if (await rejectWrongKindInstall(installed)) {
          return;
        }
        setPendingInstall(installed);
      }
    } catch (err) {
      showPluginActionError('Install failed', err, 'The plugin could not be installed.');
    }
  }, [rejectWrongKindInstall, showPluginActionError]);

  /**
   * Clones a plugin from a public git repository URL.
   */
  const handleInstallFromGit = useCallback(async (): Promise<void> => {
    const url = gitInstallUrl.trim();
    if (!url) {
      setGitInstallError('Repository URL is required.');
      return;
    }
    setGitInstallBusy(true);
    setGitInstallError(null);
    try {
      const ref = gitInstallRef.trim() || undefined;
      const installed = await window.api.installPluginFromGit(url, ref);
      if (await rejectWrongKindInstall(installed)) {
        return;
      }
      setGitInstallUrl('');
      setGitInstallRef('');
      setPendingInstall(installed);
    } catch (err) {
      showPluginActionError('Install failed', err, 'The plugin could not be installed from git.');
    } finally {
      setGitInstallBusy(false);
    }
  }, [gitInstallUrl, gitInstallRef, rejectWrongKindInstall, showPluginActionError]);

  /**
   * Re-clones a git-installed plugin from its stored origin.
   *
   * @param pluginId - Plugin manifest id.
   */
  const handleUpdateFromGit = useCallback(
    async (pluginId: string): Promise<void> => {
      setGitUpdateBusyId(pluginId);
      try {
        await window.api.updatePluginFromGit(pluginId);
        await refresh();
      } catch (err) {
        showPluginActionError('Update failed', err, 'The plugin could not be updated from git.');
      } finally {
        setGitUpdateBusyId(null);
      }
    },
    [refresh, showPluginActionError]
  );

  /**
   * Installs a marketplace plugin via the existing git clone flow.
   *
   * @param entry - Catalog listing to install.
   */
  const handleCatalogInstall = useCallback(
    async (entry: PluginCatalogEntry): Promise<void> => {
      setCatalogActionBusyId(entry.id);
      try {
        const installed = await window.api.installPluginFromGit(entry.repoUrl, entry.ref);
        if (await rejectWrongKindInstall(installed)) {
          return;
        }
        closeCatalogDetailAfterInstall();
        setPendingInstall(installed);
      } catch (err) {
        showPluginActionError('Install failed', err, 'The plugin could not be installed.');
      } finally {
        setCatalogActionBusyId(null);
      }
    },
    [closeCatalogDetailAfterInstall, rejectWrongKindInstall, showPluginActionError]
  );

  /**
   * Opens the load-unpacked dialog and shows the permissions modal.
   */
  const handleLoadUnpacked = useCallback(async (): Promise<void> => {
    try {
      const loaded = await window.api.loadUnpackedPlugin();
      if (loaded) {
        if (await rejectWrongKindInstall(loaded)) {
          return;
        }
        setPendingInstall(loaded);
      }
    } catch (err) {
      showPluginActionError('Load failed', err, 'The unpacked plugin could not be loaded.');
    }
  }, [rejectWrongKindInstall, showPluginActionError]);

  /**
   * Toggles enablement for one plugin row.
   *
   * @param plugin - Plugin to enable or disable.
   */
  const handleToggleEnabled = useCallback(
    async (plugin: PluginInfo): Promise<void> => {
      if (!plugin.enabled) {
        queueThemePromptIfNeeded(plugin);
      }
      await window.api.setPluginEnabled(plugin.id, !plugin.enabled);
      await refresh();
    },
    [refresh]
  );

  /**
   * Reloads one unpacked plugin from disk.
   *
   * @param plugin - Plugin to reload from its unpacked source path.
   */
  const handleReload = useCallback(
    async (plugin: PluginInfo): Promise<void> => {
      await window.api.reloadPlugin(plugin.id);
      await refresh();
      toast.success(
        `${kind === 'themes' ? formatThemeDisplayName(plugin.name) : plugin.name} reloaded.`
      );
    },
    [refresh, kind]
  );

  /**
   * Removes an installed or unpacked plugin after confirmation.
   *
   * @param plugin - Plugin to remove.
   */
  const handleRemove = useCallback(
    async (plugin: PluginInfo): Promise<void> => {
      const displayName =
        kind === 'themes' || pluginIsTheme(plugin)
          ? formatThemeDisplayName(plugin.name)
          : plugin.name;
      const confirmed = await showConfirm(dispatch, {
        title: isManagedInstall(plugin) ? 'Uninstall plugin?' : 'Remove dev plugin?',
        message: isManagedInstall(plugin)
          ? `Remove ${displayName} and delete its files from HarborClient?`
          : `Stop loading ${displayName} from ${plugin.path}? Your source folder will not be deleted.`,
        confirmLabel: isManagedInstall(plugin) ? 'Uninstall' : 'Remove',
        variant: 'danger'
      });
      if (!confirmed) {
        return;
      }
      if (isManagedInstall(plugin)) {
        await window.api.uninstallPlugin(plugin.id);
      } else {
        await window.api.removeUnpackedPlugin(plugin.id);
      }
      if (detailPlugin?.id === plugin.id) {
        closeDetail();
      }
      await refresh();
    },
    [dispatch, detailPlugin, closeDetail, refresh, kind]
  );

  /**
   * Updates the git install URL field and clears validation errors.
   */
  const onGitInstallUrlChange = useCallback((url: string): void => {
    setGitInstallUrl(url);
    setGitInstallError(null);
  }, []);

  /**
   * Updates the git install ref field and clears validation errors.
   */
  const onGitInstallRefChange = useCallback((ref: string): void => {
    setGitInstallRef(ref);
    setGitInstallError(null);
  }, []);

  return {
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
  };
}
