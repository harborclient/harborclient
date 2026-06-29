import { useCallback, useEffect, useMemo, useState, type JSX, type KeyboardEvent } from 'react';
import toast from 'react-hot-toast';
import type {
  PluginCatalog,
  PluginCatalogEntry,
  PluginSource,
  PluginSourcesSettings
} from '#/shared/plugin/catalog';
import { getDefaultPluginSources, pluginSourcesSchema } from '#/shared/plugin/catalog';
import {
  PLUGIN_CATALOG_CATEGORIES,
  PLUGIN_CATALOG_CATEGORY_LABELS,
  type PluginCatalogCategory
} from '#/shared/plugin/catalogCategories';
import {
  buildPluginCatalogSearchIndex,
  filterPluginCatalogByCategory,
  searchPluginCatalog
} from '#/shared/plugin/catalogSearch';
import type { PluginInfo } from '#/shared/plugin/types';
import type { TeamHubPluginSource } from '#/shared/types';
import { Button } from '@harborclient/sdk/components';
import { FormGroup } from '@harborclient/sdk/components';
import { FaIcon } from '@harborclient/sdk/components';
import { Input } from '@harborclient/sdk/components';
import { Select } from '@harborclient/sdk/components';
import { Page } from '@harborclient/sdk/components';
import {
  faAngleLeft,
  faCircleCheck,
  faDownload,
  faGear,
  faPuzzlePiece,
  faStore
} from '#/renderer/src/fontawesome';
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
import type { PluginGitPreview } from '#/shared/plugin/types';
import {
  findInstalledCatalogPlugin,
  isManagedInstall,
  resolvePendingPluginInstallDeepLink,
  stopRowActivation
} from './helpers';
import { CatalogCard } from './CatalogCard';
import { EnableModal } from './EnableModal';
import { ErrorMessages } from './ErrorMessages';
import { GitInstallModal } from './GitInstallModal';
import { InstallModal } from './InstallModal';
import { PluginDetailModal } from './PluginDetailModal';
import {
  loadInstalledPluginScreenshotSrc,
  resolveCatalogPluginScreenshotSrc
} from './resolvePluginScreenshot';
import { SourcesModal } from './SourcesModal';
import { TableExternalLink } from './TableExternalLink';
import type { SourceKind } from './types';
import { SettingsCloseButton } from '../SettingsCloseButton';
import { markPluginForThemePrompt } from '#/renderer/src/plugins/pluginLoader';

interface Props {
  /**
   * Closes the settings overlay.
   */
  onClose: () => void;
}

/**
 * Queues a theme switch prompt when the plugin manifest declares contributed themes.
 *
 * @param plugin - Plugin the user is about to enable.
 */
function queueThemePromptIfNeeded(plugin: PluginInfo): void {
  if ((plugin.manifest.contributes?.themes?.length ?? 0) > 0) {
    markPluginForThemePrompt(plugin.id);
  }
}

/**
 * Settings section for installing, enabling, and inspecting plugins.
 */
export function PluginsSection({ onClose }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const pendingPluginInstallId = useAppSelector(selectPendingPluginInstallId);
  const [showBrowse, setShowBrowse] = useState(false);
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [catalog, setCatalog] = useState<PluginCatalog | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogActionBusyId, setCatalogActionBusyId] = useState<string | null>(null);
  const [catalogDetailEntry, setCatalogDetailEntry] = useState<PluginCatalogEntry | null>(null);
  const [catalogPreview, setCatalogPreview] = useState<PluginGitPreview | null>(null);
  const [catalogPreviewLoadState, setCatalogPreviewLoadState] = useState<
    'idle' | 'loading' | 'loaded' | 'error'
  >('idle');
  const [catalogPreviewError, setCatalogPreviewError] = useState<string | null>(null);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<PluginCatalogCategory | ''>(
    ''
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailPlugin, setDetailPlugin] = useState<PluginInfo | null>(null);
  const [pendingInstall, setPendingInstall] = useState<PluginInfo | null>(null);
  const [descriptionMarkdown, setDescriptionMarkdown] = useState<string>('');
  const [descriptionLoadState, setDescriptionLoadState] = useState<
    'idle' | 'loading' | 'loaded' | 'error'
  >('idle');
  const [detailScreenshotSrc, setDetailScreenshotSrc] = useState<string | undefined>(undefined);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showGitInstallModal, setShowGitInstallModal] = useState(false);
  const [gitInstallUrl, setGitInstallUrl] = useState('');
  const [gitInstallRef, setGitInstallRef] = useState('');
  const [gitInstallError, setGitInstallError] = useState<string | null>(null);
  const [gitInstallBusy, setGitInstallBusy] = useState(false);
  const [gitUpdateBusyId, setGitUpdateBusyId] = useState<string | null>(null);
  const [showPluginSourcesModal, setShowPluginSourcesModal] = useState(false);
  const [pluginSourcesDraft, setPluginSourcesDraft] =
    useState<PluginSourcesSettings>(getDefaultPluginSources());
  const [pluginSourcesBusy, setPluginSourcesBusy] = useState(false);
  const [pluginSourcesLoadError, setPluginSourcesLoadError] = useState<string | null>(null);
  const [teamHubPluginSources, setTeamHubPluginSources] = useState<{
    catalogs: TeamHubPluginSource[];
    trusted: TeamHubPluginSource[];
  }>({ catalogs: [], trusted: [] });

  /**
   * Opens the plugin sources settings modal and loads persisted endpoints.
   */
  const openPluginSourcesModal = (): void => {
    setPluginSourcesLoadError(null);
    setPluginSourcesBusy(true);
    setShowPluginSourcesModal(true);
    void Promise.all([window.api.getPluginSources(), window.api.getTeamHubPluginSources()])
      .then(([settings, hubSources]) => {
        setPluginSourcesDraft(settings);
        setTeamHubPluginSources(hubSources);
      })
      .catch((err) => {
        setPluginSourcesLoadError(err instanceof Error ? err.message : String(err));
        setPluginSourcesDraft(getDefaultPluginSources());
        setTeamHubPluginSources({ catalogs: [], trusted: [] });
      })
      .finally(() => {
        setPluginSourcesBusy(false);
      });
  };

  /**
   * Closes the plugin sources settings modal without saving.
   */
  const closePluginSourcesModal = (): void => {
    if (pluginSourcesBusy) {
      return;
    }
    setShowPluginSourcesModal(false);
    setPluginSourcesLoadError(null);
  };

  /**
   * Replaces the draft plugin source settings with HarborClient defaults.
   */
  const resetPluginSourcesDraft = (): void => {
    setPluginSourcesDraft(getDefaultPluginSources());
    setPluginSourcesLoadError(null);
  };

  /**
   * Updates one draft plugin source row in the modal.
   *
   * @param kind - Catalog or trusted endpoint list being edited.
   * @param index - Row index within the list.
   * @param source - Updated source row.
   */
  const updatePluginSourceDraft = (kind: SourceKind, index: number, source: PluginSource): void => {
    setPluginSourcesDraft((current) => ({
      ...current,
      [kind]: current[kind].map((entry, entryIndex) => (entryIndex === index ? source : entry))
    }));
  };

  /**
   * Removes one draft plugin source row from the modal.
   *
   * @param kind - Catalog or trusted endpoint list being edited.
   * @param index - Row index to remove.
   */
  const removePluginSourceDraft = (kind: SourceKind, index: number): void => {
    setPluginSourcesDraft((current) => ({
      ...current,
      [kind]: current[kind].filter((_entry, entryIndex) => entryIndex !== index)
    }));
  };

  /**
   * Adds one draft plugin source row to the modal.
   *
   * @param kind - Catalog or trusted endpoint list being edited.
   * @param url - Endpoint URL to append.
   * @returns Validation error message, or null when the row was added.
   */
  const addPluginSourceDraft = (kind: SourceKind, url: string): string | null => {
    const candidate: PluginSourcesSettings = {
      ...pluginSourcesDraft,
      [kind]: [...pluginSourcesDraft[kind], { url, enabled: true }]
    };
    const parsed = pluginSourcesSchema.safeParse(candidate);
    if (!parsed.success) {
      return 'Enter a valid http:// or https:// URL.';
    }
    setPluginSourcesDraft(parsed.data);
    return null;
  };

  /**
   * Persists draft plugin source settings and refreshes the marketplace catalog.
   */
  const savePluginSources = async (): Promise<void> => {
    setPluginSourcesBusy(true);
    setPluginSourcesLoadError(null);
    try {
      const saved = await window.api.setPluginSources(pluginSourcesDraft);
      setPluginSourcesDraft(saved);
      setShowPluginSourcesModal(false);
      if (showBrowse) {
        setCatalog(null);
        await loadCatalog();
      }
      toast.success('Plugin sources saved.');
    } catch (err) {
      setPluginSourcesLoadError(
        formatIpcErrorMessage(err, 'Plugin source settings could not be saved.')
      );
    } finally {
      setPluginSourcesBusy(false);
    }
  };

  /**
   * Shows a blocking alert when a user-initiated plugin action fails.
   *
   * @param title - Dialog heading.
   * @param err - Caught error from the IPC call.
   * @param fallback - Message when the error cannot be parsed.
   */
  const showPluginActionError = (title: string, err: unknown, fallback: string): void => {
    showAlert(dispatch, formatIpcErrorMessage(err, fallback), title, { icon: 'warning' });
  };

  /**
   * Loads the plugin list from the main process and keeps the open detail row in sync.
   *
   * @returns Fresh plugin rows from the main process.
   */
  const refresh = useCallback(async (): Promise<PluginInfo[]> => {
    setLoading(true);
    setError(null);
    try {
      const next = await window.api.listPlugins();
      setPlugins(next);
      setDetailPlugin((current) =>
        current ? (next.find((plugin) => plugin.id === current.id) ?? null) : null
      );
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Loads plugins on mount and when the main process reports changes.
   */
  useEffect(() => {
    let active = true;
    void window.api
      .listPlugins()
      .then((next) => {
        if (active) {
          setPlugins(next);
          setLoading(false);
          setError(null);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });
    const unsubscribe = window.api.onPluginsChanged(() => {
      void refresh();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [refresh]);

  /**
   * Loads the detail plugin description markdown when the detail modal opens.
   */
  useEffect(() => {
    let active = true;
    const descriptionPath = detailPlugin?.manifest.description;
    if (!detailPlugin || !descriptionPath) {
      return () => {
        active = false;
      };
    }
    void window.api
      .readPluginAsset(detailPlugin.id, descriptionPath)
      .then((asset) => {
        if (active) {
          setDescriptionMarkdown(atob(asset.content));
          setDescriptionLoadState('loaded');
        }
      })
      .catch(() => {
        if (active) {
          setDescriptionMarkdown('');
          setDescriptionLoadState('error');
        }
      });
    return () => {
      active = false;
    };
  }, [detailPlugin]);

  /**
   * Maps loaded marketplace catalog entries by plugin id for screenshot lookup.
   */
  const catalogById = useMemo(() => {
    if (!catalog?.plugins.length) {
      return new Map<string, PluginCatalogEntry>();
    }
    return new Map(catalog.plugins.map((entry) => [entry.id, entry]));
  }, [catalog]);

  /**
   * Loads the installed plugin screenshot when the detail modal opens.
   */
  useEffect(() => {
    let active = true;
    if (!detailPlugin) {
      return () => {
        active = false;
      };
    }

    void loadInstalledPluginScreenshotSrc(
      detailPlugin,
      catalogById.get(detailPlugin.id)?.screenshot
    ).then((screenshotSrc) => {
      if (active) {
        setDetailScreenshotSrc(screenshotSrc);
      }
    });

    return () => {
      active = false;
    };
  }, [detailPlugin, catalogById]);

  /**
   * Fetches remote manifest preview data when a marketplace detail modal opens.
   */
  useEffect(() => {
    let active = true;
    if (!catalogDetailEntry) {
      return () => {
        active = false;
      };
    }

    void window.api
      .previewPluginFromGit(catalogDetailEntry.repoUrl, catalogDetailEntry.ref)
      .then((preview) => {
        if (active) {
          setCatalogPreview(preview);
          setCatalogPreviewLoadState('loaded');
        }
      })
      .catch((err) => {
        if (active) {
          setCatalogPreview(null);
          setCatalogPreviewLoadState('error');
          setCatalogPreviewError(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      active = false;
    };
  }, [catalogDetailEntry]);

  /**
   * Loads the marketplace catalog from harborclient.com.
   */
  const loadCatalog = useCallback(async (): Promise<void> => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const next = await window.api.getPluginCatalog();
      setCatalog(next);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : String(err));
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  /**
   * Toggles between the installed-plugins list and the marketplace catalog.
   */
  const toggleBrowseView = (): void => {
    setShowBrowse((current) => {
      const next = !current;
      if (!next) {
        setCatalogDetailEntry(null);
        setCatalogPreview(null);
        setCatalogPreviewLoadState('idle');
        setCatalogPreviewError(null);
        setCatalogSearchQuery('');
        setCatalogCategoryFilter('');
      }
      if (next && !catalog && !catalogLoading) {
        void loadCatalog();
      }
      return next;
    });
  };

  /**
   * Closes the marketplace detail modal.
   */
  const closeCatalogDetail = (): void => {
    setCatalogDetailEntry(null);
    setCatalogPreview(null);
    setCatalogPreviewLoadState('idle');
    setCatalogPreviewError(null);
    setCatalogError(null);
  };

  /**
   * Builds a searchable index over the loaded marketplace catalog.
   */
  const catalogSearchIndex = useMemo(() => {
    if (!catalog?.plugins.length) {
      return null;
    }
    return buildPluginCatalogSearchIndex(catalog.plugins);
  }, [catalog]);

  /**
   * Filters marketplace catalog rows by category and search query.
   */
  const filteredCatalogPlugins = useMemo(() => {
    if (!catalog?.plugins.length) {
      return [];
    }

    const byCategory = filterPluginCatalogByCategory(catalog.plugins, catalogCategoryFilter);
    if (!catalogSearchIndex) {
      return byCategory;
    }

    const searched = searchPluginCatalog(catalog.plugins, catalogSearchIndex, catalogSearchQuery);
    if (!catalogCategoryFilter) {
      return searched;
    }

    const categoryIds = new Set(byCategory.map((entry) => entry.id));
    return searched.filter((entry) => categoryIds.has(entry.id));
  }, [catalog, catalogSearchIndex, catalogSearchQuery, catalogCategoryFilter]);

  /**
   * Opens the read-only detail modal for one installed plugin.
   *
   * @param plugin - Plugin row to inspect.
   */
  const openDetail = (plugin: PluginInfo): void => {
    setDescriptionMarkdown('');
    setDescriptionLoadState(plugin.manifest.description ? 'loading' : 'idle');
    setDetailScreenshotSrc(undefined);
    setDetailPlugin(plugin);
  };

  /**
   * Handles a harborclient:// plugin install deep link queued in navigation state.
   */
  useEffect(() => {
    if (!pendingPluginInstallId) {
      return;
    }

    const pluginId = pendingPluginInstallId;
    let cancelled = false;

    const run = async (): Promise<void> => {
      setShowBrowse(true);
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
  }, [pendingPluginInstallId, dispatch]);

  /**
   * Closes the read-only detail modal and clears loaded description text.
   */
  const closeDetail = (): void => {
    setDetailPlugin(null);
    setDescriptionMarkdown('');
    setDescriptionLoadState('idle');
    setDetailScreenshotSrc(undefined);
  };

  /**
   * Opens the marketplace detail modal for one catalog listing.
   *
   * @param entry - Catalog row to inspect.
   */
  const openCatalogDetail = (entry: PluginCatalogEntry): void => {
    const installed = findInstalledCatalogPlugin(plugins, entry.id);
    if (installed) {
      openDetail(installed);
      return;
    }
    setCatalogError(null);
    setCatalogPreview(null);
    setCatalogPreviewLoadState('loading');
    setCatalogPreviewError(null);
    setCatalogDetailEntry(entry);
  };

  /**
   * Opens the detail modal when a table row is activated from the keyboard.
   *
   * @param event - Keyboard event on the row.
   * @param plugin - Plugin row to inspect.
   */
  const handleRowKeyDown = (
    event: KeyboardEvent<HTMLTableRowElement>,
    plugin: PluginInfo
  ): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openDetail(plugin);
    }
  };

  /**
   * Closes the permissions dialog and optionally removes a just-installed plugin.
   *
   * @param keep - When false, uninstall/remove the pending plugin.
   */
  const closePendingInstall = async (keep: boolean): Promise<void> => {
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
  };

  /**
   * Opens the install method chooser modal.
   */
  const openInstallModal = (): void => {
    setShowInstallModal(true);
  };

  /**
   * Closes the install method chooser modal.
   */
  const closeInstallModal = (): void => {
    setShowInstallModal(false);
  };

  /**
   * Opens the install-from-file dialog and shows the permissions modal.
   */
  const handleInstall = async (): Promise<void> => {
    try {
      const installed = await window.api.installPlugin();
      if (installed) {
        setPendingInstall(installed);
      }
    } catch (err) {
      showPluginActionError('Install failed', err, 'The plugin could not be installed.');
    }
  };

  /**
   * Opens the install-from-git modal with a cleared form.
   */
  const openGitInstallModal = (): void => {
    setGitInstallUrl('');
    setGitInstallRef('');
    setGitInstallError(null);
    setShowGitInstallModal(true);
  };

  /**
   * Closes the install-from-git modal.
   */
  const closeGitInstallModal = (): void => {
    if (gitInstallBusy) {
      return;
    }
    setShowGitInstallModal(false);
    setGitInstallError(null);
  };

  /**
   * Clones a plugin from a public git repository URL.
   */
  const handleInstallFromGit = async (): Promise<void> => {
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
      setShowGitInstallModal(false);
      setPendingInstall(installed);
    } catch (err) {
      showPluginActionError('Install failed', err, 'The plugin could not be installed from git.');
    } finally {
      setGitInstallBusy(false);
    }
  };

  /**
   * Re-clones a git-installed plugin from its stored origin.
   *
   * @param pluginId - Plugin manifest id.
   */
  const handleUpdateFromGit = async (pluginId: string): Promise<void> => {
    setGitUpdateBusyId(pluginId);
    try {
      await window.api.updatePluginFromGit(pluginId);
      await refresh();
    } catch (err) {
      showPluginActionError('Update failed', err, 'The plugin could not be updated from git.');
    } finally {
      setGitUpdateBusyId(null);
    }
  };

  /**
   * Installs a marketplace plugin via the existing git clone flow.
   *
   * @param entry - Catalog listing to install.
   */
  const handleCatalogInstall = async (entry: PluginCatalogEntry): Promise<void> => {
    setCatalogActionBusyId(entry.id);
    try {
      const installed = await window.api.installPluginFromGit(entry.repoUrl, entry.ref);
      setCatalogDetailEntry(null);
      setPendingInstall(installed);
    } catch (err) {
      showPluginActionError('Install failed', err, 'The plugin could not be installed.');
    } finally {
      setCatalogActionBusyId(null);
    }
  };

  /**
   * Re-clones a git-installed marketplace plugin from its stored origin.
   *
   * @param pluginId - Plugin manifest id.
   */
  const handleCatalogUpdate = async (pluginId: string): Promise<void> => {
    setCatalogActionBusyId(pluginId);
    try {
      await window.api.updatePluginFromGit(pluginId);
      await refresh();
    } catch (err) {
      showPluginActionError('Update failed', err, 'The plugin could not be updated.');
    } finally {
      setCatalogActionBusyId(null);
    }
  };

  /**
   * Opens the load-unpacked dialog and shows the permissions modal.
   */
  const handleLoadUnpacked = async (): Promise<void> => {
    try {
      const loaded = await window.api.loadUnpackedPlugin();
      if (loaded) {
        setPendingInstall(loaded);
      }
    } catch (err) {
      showPluginActionError('Load failed', err, 'The unpacked plugin could not be loaded.');
    }
  };

  /**
   * Closes the chooser and starts the install-from-file flow.
   */
  const handleInstallFromFileChoice = (): void => {
    closeInstallModal();
    void handleInstall();
  };

  /**
   * Closes the chooser and opens the install-from-git form.
   */
  const handleInstallFromGitChoice = (): void => {
    closeInstallModal();
    openGitInstallModal();
  };

  /**
   * Closes the chooser and starts the load-unpacked flow.
   */
  const handleLoadUnpackedChoice = (): void => {
    closeInstallModal();
    void handleLoadUnpacked();
  };

  /**
   * Toggles enablement for one plugin row.
   *
   * @param plugin - Plugin to enable or disable.
   */
  const handleToggleEnabled = async (plugin: PluginInfo): Promise<void> => {
    if (!plugin.enabled) {
      queueThemePromptIfNeeded(plugin);
    }
    await window.api.setPluginEnabled(plugin.id, !plugin.enabled);
    await refresh();
  };

  /**
   * Reloads one unpacked plugin from disk.
   *
   * @param plugin - Plugin to reload from its unpacked source path.
   */
  const handleReload = async (plugin: PluginInfo): Promise<void> => {
    await window.api.reloadPlugin(plugin.id);
    await refresh();
    toast.success(`${plugin.name} reloaded.`);
  };

  /**
   * Removes an installed or unpacked plugin after confirmation.
   *
   * @param plugin - Plugin to remove.
   */
  const handleRemove = async (plugin: PluginInfo): Promise<void> => {
    const confirmed = await showConfirm(dispatch, {
      title: isManagedInstall(plugin) ? 'Uninstall plugin?' : 'Remove dev plugin?',
      message: isManagedInstall(plugin)
        ? `Remove ${plugin.name} and delete its files from HarborClient?`
        : `Stop loading ${plugin.name} from ${plugin.path}? Your source folder will not be deleted.`,
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
  };

  return (
    <Page
      embedded
      title="Plugins"
      icon={faPuzzlePiece}
      description="Install, enable, and manage plugins from the marketplace or local packages."
      actions={
        <>
          <Button
            type="button"
            variant={showBrowse ? 'secondary' : 'primary'}
            aria-pressed={showBrowse}
            className="inline-flex items-center gap-1.5"
            onClick={toggleBrowseView}
          >
            {showBrowse ? (
              <>
                <FaIcon icon={faAngleLeft} className="h-3.5 w-3.5" />
                Installed
              </>
            ) : (
              <>
                <FaIcon icon={faStore} className="h-3.5 w-3.5" />
                Marketplace
              </>
            )}
          </Button>
          {!showBrowse ? (
            <>
              <Button
                type="button"
                className="inline-flex items-center gap-1.5"
                onClick={openInstallModal}
              >
                <FaIcon icon={faDownload} className="h-3.5 w-3.5" />
                Install
              </Button>
              <Button
                type="button"
                className="inline-flex items-center gap-1.5"
                onClick={openPluginSourcesModal}
              >
                <FaIcon icon={faGear} className="h-3.5 w-3.5" />
                Settings
              </Button>
            </>
          ) : null}
          <SettingsCloseButton onClose={onClose} />
        </>
      }
    >
      {showBrowse ? (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <FormGroup label="Search plugins" htmlFor="plugin-catalog-search" srOnly>
            <Input
              id="plugin-catalog-search"
              type="search"
              placeholder="Search plugins"
              value={catalogSearchQuery}
              disabled={catalogLoading}
              className="w-full max-w-md"
              onChange={(event) => setCatalogSearchQuery(event.target.value)}
            />
          </FormGroup>
          <FormGroup label="" htmlFor="plugin-catalog-category">
            <Select
              id="plugin-catalog-category"
              value={catalogCategoryFilter}
              disabled={catalogLoading}
              className="w-full max-w-xs"
              onChange={(event) =>
                setCatalogCategoryFilter(event.target.value as PluginCatalogCategory | '')
              }
            >
              <option value="">All categories</option>
              {PLUGIN_CATALOG_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {PLUGIN_CATALOG_CATEGORY_LABELS[category]}
                </option>
              ))}
            </Select>
          </FormGroup>
        </div>
      ) : null}

      {!showBrowse ? (
        <>
          {error ? <p className="text-danger">{error}</p> : null}
          {loading ? (
            <p className="text-muted" role="status">
              Loading plugins…
            </p>
          ) : null}

          {!loading && plugins.length === 0 ? (
            <p className="text-muted">No plugins installed yet.</p>
          ) : null}

          {!loading && plugins.length > 0 ? (
            <div className="overflow-x-auto rounded-md border border-separator">
              <table className="w-full border-collapse text-[14px]">
                <caption className="sr-only">Installed plugins</caption>
                <thead>
                  <tr className="border-b border-separator bg-sidebar/40 text-left">
                    <th scope="col" className="px-3 py-2 font-medium text-text">
                      Plugin
                    </th>
                    <th scope="col" className="px-3 py-2 text-center font-medium text-text">
                      Version
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium text-text">
                      Publisher
                    </th>
                    <th
                      scope="col"
                      className="w-0 whitespace-nowrap px-3 py-2 font-medium text-text"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {plugins.map((plugin) => {
                    const gitUpdateBusy = gitUpdateBusyId === plugin.id;

                    return (
                      <tr
                        key={plugin.id}
                        tabIndex={0}
                        className="cursor-pointer border-b border-separator last:border-b-0 hover:bg-selection/40"
                        aria-label={`View details for ${plugin.name}`}
                        onClick={() => openDetail(plugin)}
                        onKeyDown={(event) => handleRowKeyDown(event, plugin)}
                      >
                        <td className="px-3 py-2 align-middle">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-text">{plugin.name}</span>
                            {plugin.signature?.status === 'invalid' ? (
                              <span className="rounded bg-danger/20 px-1.5 py-0.5 text-[14px] text-danger">
                                Invalid signature
                              </span>
                            ) : null}
                            {plugin.signature?.status === 'untrusted' ? (
                              <span className="rounded bg-danger/20 px-1.5 py-0.5 text-[14px] text-danger">
                                Untrusted publisher
                              </span>
                            ) : null}
                            {plugin.runtimeError && plugin.enabled ? (
                              <span className="rounded bg-danger/20 px-1.5 py-0.5 text-[14px] text-danger">
                                Error
                              </span>
                            ) : null}
                            {plugin.manifest.homepage ? (
                              <TableExternalLink
                                href={plugin.manifest.homepage}
                                label="Homepage"
                                pluginName={plugin.name}
                              />
                            ) : null}
                            {plugin.source === 'unpacked' ? (
                              <span className="rounded bg-info/20 px-1.5 py-0.5 text-[14px] text-text">
                                Development
                              </span>
                            ) : null}
                            {plugin.source === 'git' ? (
                              <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[14px] text-text">
                                Git
                              </span>
                            ) : null}
                          </div>
                          <div className="text-[14px] text-muted">{plugin.id}</div>
                          <ErrorMessages plugin={plugin} />
                        </td>
                        <td className="px-3 py-2 text-center align-middle text-text">
                          {plugin.version}
                        </td>
                        <td className="px-3 py-2 align-middle text-text">
                          <div className="flex items-center gap-2">
                            {plugin.manifest.author ? (
                              plugin.manifest.author
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                            {plugin.signature?.status === 'verified' ? (
                              <FaIcon
                                icon={faCircleCheck}
                                className="h-3.5 w-3.5 shrink-0 text-success"
                                title={`Verified publisher: ${plugin.signature.author ?? plugin.manifest.author ?? 'unknown'}`}
                              />
                            ) : null}
                          </div>
                        </td>
                        <td
                          className="w-0 whitespace-nowrap px-3 py-2 align-middle"
                          onClick={stopRowActivation}
                          onMouseDown={stopRowActivation}
                        >
                          <div className="flex flex-nowrap gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              aria-label={
                                plugin.enabled ? `Disable ${plugin.name}` : `Enable ${plugin.name}`
                              }
                              onClick={() => void handleToggleEnabled(plugin)}
                            >
                              {plugin.enabled ? 'Disable' : 'Enable'}
                            </Button>
                            {plugin.source === 'unpacked' ? (
                              <Button
                                type="button"
                                variant="secondary"
                                aria-label={`Reload ${plugin.name}`}
                                onClick={() => void handleReload(plugin)}
                              >
                                Reload
                              </Button>
                            ) : null}
                            {plugin.source === 'git' ? (
                              <Button
                                type="button"
                                variant="secondary"
                                disabled={gitUpdateBusy}
                                aria-label={`Update ${plugin.name}`}
                                onClick={() => void handleUpdateFromGit(plugin.id)}
                              >
                                {gitUpdateBusy ? 'Updating…' : 'Update'}
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="primaryDanger"
                              aria-label={
                                isManagedInstall(plugin)
                                  ? `Uninstall ${plugin.name}`
                                  : `Remove ${plugin.name}`
                              }
                              onClick={() => void handleRemove(plugin)}
                            >
                              {isManagedInstall(plugin) ? 'Uninstall' : 'Remove'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : (
        <>
          {catalogError ? (
            <p className="text-danger" role="alert">
              {catalogError}
            </p>
          ) : null}
          {catalogLoading ? (
            <p className="text-muted" role="status">
              Loading plugin catalog…
            </p>
          ) : null}

          {!catalogLoading && catalog?.plugins.length === 0 ? (
            <p className="text-muted">
              No plugins are listed yet. See the{' '}
              <a
                href="https://harborclient.com/plugins"
                target="_blank"
                rel="noreferrer"
                className="text-accent"
              >
                plugin marketplace
              </a>{' '}
              for submission instructions.
            </p>
          ) : null}

          {!catalogLoading &&
          catalog &&
          catalog.plugins.length > 0 &&
          filteredCatalogPlugins.length === 0 ? (
            <p className="text-muted" role="status">
              No plugins match your filters.
            </p>
          ) : null}

          {!catalogLoading && catalog && filteredCatalogPlugins.length > 0 ? (
            <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4">
              {filteredCatalogPlugins.map((entry) => (
                <CatalogCard key={entry.id} entry={entry} onOpen={() => openCatalogDetail(entry)} />
              ))}
            </ul>
          ) : null}
        </>
      )}

      {catalogDetailEntry ? (
        <PluginDetailModal
          mode="catalog"
          entry={catalogDetailEntry}
          preview={catalogPreview}
          previewLoadState={catalogPreviewLoadState}
          previewError={catalogPreviewError}
          screenshotSrc={resolveCatalogPluginScreenshotSrc(catalogDetailEntry, catalogPreview)}
          installed={findInstalledCatalogPlugin(plugins, catalogDetailEntry.id)}
          actionBusy={catalogActionBusyId === catalogDetailEntry.id}
          onClose={closeCatalogDetail}
          onInstall={() => void handleCatalogInstall(catalogDetailEntry)}
          onUpdate={() => {
            const installed = findInstalledCatalogPlugin(plugins, catalogDetailEntry.id);
            if (installed) {
              void handleCatalogUpdate(installed.id);
            }
          }}
        />
      ) : null}

      {detailPlugin ? (
        <PluginDetailModal
          mode="installed"
          plugin={detailPlugin}
          descriptionMarkdown={descriptionMarkdown}
          descriptionLoadState={descriptionLoadState}
          screenshotSrc={detailScreenshotSrc}
          onClose={closeDetail}
        />
      ) : null}

      {showInstallModal ? (
        <InstallModal
          onClose={closeInstallModal}
          onInstallFromFile={handleInstallFromFileChoice}
          onInstallFromGit={handleInstallFromGitChoice}
          onLoadUnpacked={handleLoadUnpackedChoice}
        />
      ) : null}

      {showPluginSourcesModal ? (
        <SourcesModal
          settings={pluginSourcesDraft}
          hubSources={teamHubPluginSources}
          busy={pluginSourcesBusy}
          error={pluginSourcesLoadError}
          onClose={closePluginSourcesModal}
          onSave={() => void savePluginSources()}
          onResetDefaults={resetPluginSourcesDraft}
          onUpdateSource={updatePluginSourceDraft}
          onRemoveSource={removePluginSourceDraft}
          onAddSource={addPluginSourceDraft}
        />
      ) : null}

      {showGitInstallModal ? (
        <GitInstallModal
          url={gitInstallUrl}
          ref={gitInstallRef}
          error={gitInstallError}
          busy={gitInstallBusy}
          onUrlChange={(url) => {
            setGitInstallUrl(url);
            setGitInstallError(null);
          }}
          onRefChange={(ref) => {
            setGitInstallRef(ref);
            setGitInstallError(null);
          }}
          onClose={closeGitInstallModal}
          onInstall={() => void handleInstallFromGit()}
        />
      ) : null}

      {pendingInstall ? (
        <EnableModal
          plugin={pendingInstall}
          onCancel={() => void closePendingInstall(false)}
          onConfirm={() => void closePendingInstall(true)}
        />
      ) : null}
    </Page>
  );
}
