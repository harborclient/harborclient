import { useCallback, useEffect, useMemo, useState, type JSX, type KeyboardEvent } from 'react';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { PluginCatalog, PluginCatalogEntry } from '#/shared/plugin/catalog';
import { buildPluginCatalogSearchIndex, searchPluginCatalog } from '#/shared/plugin/catalogSearch';
import type { PluginInfo, PluginPermission } from '#/shared/plugin/types';
import { Button } from '#/renderer/src/components/Button';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { Input } from '#/renderer/src/components/forms';
import { Modal } from '#/renderer/src/components/Modal';
import { faAngleLeft, faCircleCheck } from '#/renderer/src/fontawesome';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import {
  showAlert,
  showConfirm,
  formatIpcErrorMessage
} from '#/renderer/src/ui/modals/dialogHelpers';

const PERMISSION_LABELS: Record<PluginPermission, string> = {
  ui: 'UI contributions (settings, themes, toasts, commands)',
  storage: 'Plugin-scoped persistent storage',
  'filesystem:pick': 'Open/save dialogs for user-selected paths',
  'filesystem:read': 'Read from allowlisted filesystem paths',
  'filesystem:write': 'Write to allowlisted filesystem paths',
  http: 'HTTP request hooks in the main process',
  ipc: 'Custom IPC between renderer and main plugin halves'
};

interface PluginErrorMessagesProps {
  /**
   * Plugin whose manifest or runtime errors should be shown.
   */
  plugin: PluginInfo;
}

/**
 * Renders manifest load errors and runtime activation/hook failures for one plugin.
 */
function PluginErrorMessages({ plugin }: PluginErrorMessagesProps): JSX.Element | null {
  if (!plugin.error && !plugin.runtimeError) {
    return null;
  }

  return (
    <div className="mt-1 space-y-1">
      {plugin.error ? (
        <p className="m-0 text-[14px] text-danger" role="alert">
          <span className="font-medium">Load error:</span> {plugin.error}
        </p>
      ) : null}
      {plugin.runtimeError ? (
        <p className="m-0 text-[14px] text-danger" role="alert">
          <span className="font-medium">Runtime error:</span> {plugin.runtimeError}
        </p>
      ) : null}
    </div>
  );
}

interface PluginDetailModalProps {
  /**
   * Plugin whose read-only metadata and description are shown.
   */
  plugin: PluginInfo;

  /**
   * Loaded Markdown description body.
   */
  descriptionMarkdown: string;

  /**
   * Whether the description asset is loading, ready, or failed.
   */
  descriptionLoadState: 'idle' | 'loading' | 'loaded' | 'error';

  /**
   * Closes the detail dialog.
   */
  onClose: () => void;
}

/**
 * Read-only modal showing installed plugin metadata, permissions, and description.
 */
function PluginDetailModal({
  plugin,
  descriptionMarkdown,
  descriptionLoadState,
  onClose
}: PluginDetailModalProps): JSX.Element {
  return (
    <Modal
      onClose={onClose}
      className="w-[min(42rem,calc(100vw-2rem))]"
      labelledBy="plugin-detail-title"
    >
      <h2
        id="plugin-detail-title"
        className="m-0 mb-3 flex flex-wrap items-center gap-2 text-[15px] font-semibold text-text"
      >
        {plugin.name}
        {plugin.signature?.status === 'verified' ? (
          <FaIcon
            icon={faCircleCheck}
            className="h-3.5 w-3.5 shrink-0 text-success"
            title={`Verified publisher: ${plugin.signature.author ?? plugin.manifest.author ?? 'unknown'}`}
          />
        ) : null}
      </h2>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[14px]">
        <dt className="text-muted">Version</dt>
        <dd className="m-0 text-text">{plugin.version}</dd>
        <dt className="text-muted">Publisher</dt>
        <dd className="m-0 text-text">{plugin.manifest.author ?? '—'}</dd>
        <dt className="text-muted">Source</dt>
        <dd className="m-0 break-all text-text">{plugin.path}</dd>
        {plugin.repoUrl ? (
          <>
            <dt className="text-muted">Repository</dt>
            <dd className="m-0 break-all text-text">
              <a href={plugin.repoUrl} target="_blank" rel="noreferrer" className="text-accent">
                {plugin.repoUrl}
              </a>
              {plugin.repoRef ? <span className="text-muted">{` (${plugin.repoRef})`}</span> : null}
            </dd>
          </>
        ) : null}
      </dl>

      <div className="mt-3 flex flex-wrap gap-3 text-[14px]">
        {plugin.manifest.homepage ? (
          <a
            href={plugin.manifest.homepage}
            target="_blank"
            rel="noreferrer"
            className="text-accent"
          >
            Website
          </a>
        ) : null}
        {plugin.manifest.bugs?.url ? (
          <a
            href={plugin.manifest.bugs.url}
            target="_blank"
            rel="noreferrer"
            className="text-accent"
          >
            Report issue
          </a>
        ) : null}
      </div>

      <PluginErrorMessages plugin={plugin} />

      <div className="mt-4 border-t border-separator pt-4">
        <h3 className="m-0 mb-2 text-[14px] font-medium text-text">Permissions</h3>
        <ul className="m-0 list-disc pl-5 text-[14px] text-text">
          {plugin.permissions.map((permission) => (
            <li key={permission}>{PERMISSION_LABELS[permission] ?? permission}</li>
          ))}
        </ul>
      </div>

      {plugin.manifest.description ? (
        <div className="prose prose-base mt-4 max-h-[min(28rem,50vh)] max-w-none overflow-y-auto border-t border-separator pt-4 text-text">
          {descriptionLoadState === 'loading' ? (
            <p className="text-muted" role="status">
              Loading description…
            </p>
          ) : descriptionLoadState === 'error' ? (
            <p className="text-danger" role="alert">
              Could not load the plugin description.
            </p>
          ) : descriptionMarkdown ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{descriptionMarkdown}</ReactMarkdown>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}

/**
 * Returns whether a plugin is installed under userData (file or git), not dev-unpacked.
 *
 * @param plugin - Plugin metadata row.
 */
function isManagedInstall(plugin: PluginInfo): boolean {
  return plugin.source === 'installed' || plugin.source === 'git';
}

/**
 * Returns the installed plugin row matching a catalog entry id, if any.
 *
 * @param plugins - Installed plugin rows from the main process.
 * @param entryId - Catalog manifest id.
 */
function findInstalledCatalogPlugin(
  plugins: PluginInfo[],
  entryId: string
): PluginInfo | undefined {
  return plugins.find((plugin) => plugin.id === entryId);
}

/**
 * Stops row-level click handlers from firing when interacting with row action buttons.
 *
 * @param event - DOM event from an action control inside a table row.
 */
function stopRowActivation(event: { stopPropagation(): void }): void {
  event.stopPropagation();
}

interface PluginTableExternalLinkProps {
  /**
   * Destination URL opened in the system browser.
   */
  href: string;

  /**
   * Visible link text shown in the table cell.
   */
  label: string;

  /**
   * Plugin display name used in the accessible link label.
   */
  pluginName: string;
}

/**
 * External link in a plugin table row that does not activate the row click handler.
 */
function PluginTableExternalLink({
  href,
  label,
  pluginName
}: PluginTableExternalLinkProps): JSX.Element {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-accent"
      aria-label={`${label} for ${pluginName}`}
      onClick={stopRowActivation}
      onMouseDown={stopRowActivation}
    >
      {label}
    </a>
  );
}

interface PluginCatalogCardProps {
  /**
   * Marketplace listing rendered in the browse grid.
   */
  entry: PluginCatalogEntry;

  /**
   * Opens the catalog detail modal for this listing.
   */
  onOpen: () => void;
}

/**
 * Compact marketplace preview card; opens the detail modal on activation.
 */
function PluginCatalogCard({ entry, onOpen }: PluginCatalogCardProps): JSX.Element {
  /**
   * Opens the detail modal when the card is activated from the keyboard.
   *
   * @param event - Keyboard event on the card.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLLIElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <li
      tabIndex={0}
      className="flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-md border border-separator bg-control hover:bg-selection/40"
      aria-label={`View details for ${entry.name}`}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
    >
      {entry.screenshot ? (
        <img
          src={entry.screenshot}
          alt=""
          className="h-40 w-full border-b border-separator object-cover object-top"
        />
      ) : (
        <div
          className="flex h-40 w-full items-center justify-center border-b border-separator bg-panel text-[14px] text-muted"
          aria-hidden
        >
          No preview
        </div>
      )}

      <div className="flex flex-col gap-1.5 p-3">
        <h3 className="m-0 truncate text-[14px] font-semibold text-text">{entry.name}</h3>
        <p className="m-0 line-clamp-3 text-[14px] text-text">{entry.summary}</p>
        <p className="m-0 text-[14px] text-muted">{entry.version}</p>
        <div className="flex flex-wrap gap-1.5">
          {entry.categories.map((category) => (
            <span key={category} className="rounded bg-accent/15 px-2 py-0.5 text-[14px] text-text">
              {category}
            </span>
          ))}
        </div>
      </div>
    </li>
  );
}

interface PluginCatalogDetailModalProps {
  /**
   * Marketplace listing shown in the detail dialog.
   */
  entry: PluginCatalogEntry;

  /**
   * Installed plugin row when this catalog id is already present.
   */
  installed: PluginInfo | undefined;

  /**
   * Whether an install or update action is in progress for this listing.
   */
  actionBusy: boolean;

  /**
   * Closes the detail dialog.
   */
  onClose: () => void;

  /**
   * Installs the plugin from its git repository URL.
   */
  onInstall: () => void;

  /**
   * Re-clones an installed git plugin from its stored origin.
   */
  onUpdate: () => void;
}

/**
 * Marketplace detail dialog with catalog metadata and install actions.
 */
function PluginCatalogDetailModal({
  entry,
  installed,
  actionBusy,
  onClose,
  onInstall,
  onUpdate
}: PluginCatalogDetailModalProps): JSX.Element {
  const displayVersion = installed?.version ?? entry.version;

  return (
    <Modal
      onClose={onClose}
      className="w-[min(42rem,calc(100vw-2rem))]"
      labelledBy="plugin-catalog-detail-title"
    >
      <h2 id="plugin-catalog-detail-title" className="m-0 mb-3 text-[15px] font-semibold text-text">
        {entry.name}
      </h2>

      {entry.screenshot ? (
        <img
          src={entry.screenshot}
          alt=""
          className="mb-4 max-h-64 w-full rounded-md border border-separator object-cover object-top"
        />
      ) : null}

      <p className="m-0 mb-4 text-[14px] text-text">{entry.summary}</p>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[14px]">
        <dt className="text-muted">Publisher</dt>
        <dd className="m-0 text-text">{entry.author}</dd>
        <dt className="text-muted">Version</dt>
        <dd className="m-0 text-text">{displayVersion}</dd>
        <dt className="text-muted">Plugin id</dt>
        <dd className="m-0 break-all text-text">{entry.id}</dd>
        {entry.ref ? (
          <>
            <dt className="text-muted">Git ref</dt>
            <dd className="m-0 text-text">{entry.ref}</dd>
          </>
        ) : null}
        {entry.minAppVersion ? (
          <>
            <dt className="text-muted">Minimum app version</dt>
            <dd className="m-0 text-text">{entry.minAppVersion}</dd>
          </>
        ) : null}
      </dl>

      <div className="mt-3 flex flex-wrap gap-2">
        {entry.categories.map((category) => (
          <span key={category} className="rounded bg-accent/15 px-2 py-0.5 text-[14px] text-text">
            {category}
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[14px]">
        <a href={entry.repoUrl} target="_blank" rel="noreferrer" className="text-accent">
          View on GitHub
        </a>
        {entry.homepage ? (
          <a href={entry.homepage} target="_blank" rel="noreferrer" className="text-accent">
            Website
          </a>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
        {installed ? (
          installed.source === 'git' ? (
            <Button
              type="button"
              disabled={actionBusy}
              aria-label={`Update ${entry.name}`}
              onClick={onUpdate}
            >
              {actionBusy ? 'Updating…' : 'Update'}
            </Button>
          ) : (
            <Button type="button" disabled aria-label={`${entry.name} is installed`}>
              Installed
            </Button>
          )
        ) : (
          <Button
            type="button"
            disabled={actionBusy}
            aria-label={`Install ${entry.name}`}
            onClick={onInstall}
          >
            {actionBusy ? 'Installing…' : 'Install'}
          </Button>
        )}
      </div>
    </Modal>
  );
}

/**
 * Settings section for installing, enabling, and inspecting plugins.
 */
export function PluginsSection(): JSX.Element {
  const dispatch = useAppDispatch();
  const [showBrowse, setShowBrowse] = useState(false);
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [catalog, setCatalog] = useState<PluginCatalog | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogActionBusyId, setCatalogActionBusyId] = useState<string | null>(null);
  const [catalogDetailEntry, setCatalogDetailEntry] = useState<PluginCatalogEntry | null>(null);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailPlugin, setDetailPlugin] = useState<PluginInfo | null>(null);
  const [pendingInstall, setPendingInstall] = useState<PluginInfo | null>(null);
  const [descriptionMarkdown, setDescriptionMarkdown] = useState<string>('');
  const [descriptionLoadState, setDescriptionLoadState] = useState<
    'idle' | 'loading' | 'loaded' | 'error'
  >('idle');
  const [showGitInstallModal, setShowGitInstallModal] = useState(false);
  const [gitInstallUrl, setGitInstallUrl] = useState('');
  const [gitInstallRef, setGitInstallRef] = useState('');
  const [gitInstallError, setGitInstallError] = useState<string | null>(null);
  const [gitInstallBusy, setGitInstallBusy] = useState(false);
  const [gitUpdateBusyId, setGitUpdateBusyId] = useState<string | null>(null);

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
        setCatalogSearchQuery('');
      }
      if (next && !catalog && !catalogLoading) {
        void loadCatalog();
      }
      return next;
    });
  };

  /**
   * Opens the marketplace detail modal for one catalog listing.
   *
   * @param entry - Catalog row to inspect.
   */
  const openCatalogDetail = (entry: PluginCatalogEntry): void => {
    setCatalogError(null);
    setCatalogDetailEntry(entry);
  };

  /**
   * Closes the marketplace detail modal.
   */
  const closeCatalogDetail = (): void => {
    setCatalogDetailEntry(null);
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
   * Filters marketplace catalog rows by the current search query.
   */
  const filteredCatalogPlugins = useMemo(() => {
    if (!catalog?.plugins.length || !catalogSearchIndex) {
      return catalog?.plugins ?? [];
    }
    return searchPluginCatalog(catalog.plugins, catalogSearchIndex, catalogSearchQuery);
  }, [catalog, catalogSearchIndex, catalogSearchQuery]);

  /**
   * Opens the read-only detail modal for one installed plugin.
   *
   * @param plugin - Plugin row to inspect.
   */
  const openDetail = (plugin: PluginInfo): void => {
    setDescriptionMarkdown('');
    setDescriptionLoadState(plugin.manifest.description ? 'loading' : 'idle');
    setDetailPlugin(plugin);
  };

  /**
   * Closes the read-only detail modal and clears loaded description text.
   */
  const closeDetail = (): void => {
    setDetailPlugin(null);
    setDescriptionMarkdown('');
    setDescriptionLoadState('idle');
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
    await window.api.setPluginEnabled(plugin.id, true);
    const next = await refresh();
    const enabled = next.find((entry) => entry.id === plugin.id);
    if (enabled) {
      openDetail(enabled);
    }
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
   * Toggles enablement for one plugin row.
   *
   * @param plugin - Plugin to enable or disable.
   */
  const handleToggleEnabled = async (plugin: PluginInfo): Promise<void> => {
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
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="m-0 flex-1 text-[15px] font-semibold text-text">Plugins</h2>
        <Button
          type="button"
          variant="secondary"
          aria-pressed={showBrowse}
          className={showBrowse ? 'inline-flex items-center gap-1.5' : undefined}
          onClick={toggleBrowseView}
        >
          {showBrowse ? (
            <>
              <FaIcon icon={faAngleLeft} className="h-3.5 w-3.5" />
              Installed
            </>
          ) : (
            'Marketplace'
          )}
        </Button>
        {!showBrowse ? (
          <>
            <Button type="button" variant="secondary" onClick={() => void handleInstall()}>
              Install from file
            </Button>
            <Button type="button" variant="secondary" onClick={openGitInstallModal}>
              Install from Git…
            </Button>
            <Button type="button" variant="secondary" onClick={() => void handleLoadUnpacked()}>
              Load unpacked…
            </Button>
          </>
        ) : null}
      </div>

      {showBrowse ? (
        <div className="mb-4">
          <label htmlFor="plugin-catalog-search" className="sr-only">
            Search plugins
          </label>
          <Input
            id="plugin-catalog-search"
            type="search"
            placeholder="Search plugins"
            value={catalogSearchQuery}
            disabled={catalogLoading}
            className="w-full max-w-md"
            onChange={(event) => setCatalogSearchQuery(event.target.value)}
          />
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
                    <th scope="col" className="px-3 py-2 font-medium text-text">
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
                        <td className="px-3 py-2 align-top">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-text">{plugin.name}</span>
                            {plugin.signature?.status === 'verified' ? (
                              <FaIcon
                                icon={faCircleCheck}
                                className="h-3.5 w-3.5 shrink-0 text-success"
                                title={`Verified publisher: ${plugin.signature.author ?? plugin.manifest.author ?? 'unknown'}`}
                              />
                            ) : null}
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
                              <PluginTableExternalLink
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
                          <PluginErrorMessages plugin={plugin} />
                        </td>
                        <td className="px-3 py-2 align-top text-text">{plugin.version}</td>
                        <td className="px-3 py-2 align-top text-text">
                          {plugin.manifest.author ? (
                            plugin.manifest.author
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td
                          className="w-0 whitespace-nowrap px-3 py-2 align-top"
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
              No plugins match your search.
            </p>
          ) : null}

          {!catalogLoading && catalog && filteredCatalogPlugins.length > 0 ? (
            <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4">
              {filteredCatalogPlugins.map((entry) => (
                <PluginCatalogCard
                  key={entry.id}
                  entry={entry}
                  onOpen={() => openCatalogDetail(entry)}
                />
              ))}
            </ul>
          ) : null}
        </>
      )}

      {catalogDetailEntry ? (
        <PluginCatalogDetailModal
          entry={catalogDetailEntry}
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
          plugin={detailPlugin}
          descriptionMarkdown={descriptionMarkdown}
          descriptionLoadState={descriptionLoadState}
          onClose={closeDetail}
        />
      ) : null}

      {showGitInstallModal ? (
        <Modal onClose={closeGitInstallModal} labelledBy="plugin-git-install-title">
          <h2
            id="plugin-git-install-title"
            className="m-0 mb-2 text-[14px] font-semibold text-text"
          >
            Install from Git
          </h2>
          <p className="mb-3 text-[14px] text-muted">
            Enter a public repository URL. The repo must include a built{' '}
            <code className="text-text">manifest.json</code> and entry files at the repository root.
          </p>
          <label htmlFor="plugin-git-install-url" className="mb-1 block text-[14px] text-muted">
            Repository URL
          </label>
          <Input
            id="plugin-git-install-url"
            className="mb-3 w-full"
            type="url"
            autoFocus
            placeholder="https://github.com/example/my-plugin.git"
            value={gitInstallUrl}
            disabled={gitInstallBusy}
            onChange={(event) => {
              setGitInstallUrl(event.target.value);
              setGitInstallError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void handleInstallFromGit();
              }
            }}
          />
          <label htmlFor="plugin-git-install-ref" className="mb-1 block text-[14px] text-muted">
            Branch or tag (optional)
          </label>
          <Input
            id="plugin-git-install-ref"
            className="w-full"
            type="text"
            placeholder="main"
            value={gitInstallRef}
            disabled={gitInstallBusy}
            onChange={(event) => {
              setGitInstallRef(event.target.value);
              setGitInstallError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void handleInstallFromGit();
              }
            }}
          />
          {gitInstallError ? (
            <p className="mt-3 text-[14px] text-danger" role="alert">
              {gitInstallError}
            </p>
          ) : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={gitInstallBusy}
              onClick={closeGitInstallModal}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={gitInstallBusy || !gitInstallUrl.trim()}
              onClick={() => void handleInstallFromGit()}
            >
              {gitInstallBusy ? 'Cloning…' : 'Install'}
            </Button>
          </div>
        </Modal>
      ) : null}

      {pendingInstall ? (
        <Modal
          onClose={() => void closePendingInstall(false)}
          labelledBy="plugin-permissions-title"
        >
          <h2
            id="plugin-permissions-title"
            className="m-0 mb-2 text-[14px] font-semibold text-text"
          >
            Enable {pendingInstall.name}?
          </h2>
          <p className="mb-3 text-[14px] text-text">
            Version {pendingInstall.version} requests the following permissions:
          </p>
          {pendingInstall.signature?.status === 'verified' ? (
            <p className="mb-3 flex items-center gap-2 text-[14px] text-text" role="status">
              <FaIcon icon={faCircleCheck} className="h-3.5 w-3.5 shrink-0 text-success" />
              Verified by {pendingInstall.signature.author ?? pendingInstall.manifest.author}
            </p>
          ) : null}
          {pendingInstall.signature?.status === 'unsigned' ? (
            <p className="mb-3 text-[14px] text-danger" role="alert">
              This plugin is not signed by a trusted publisher. Only enable it if you trust the
              source.
            </p>
          ) : null}
          <ul className="mb-4 list-disc pl-5 text-[14px] text-text">
            {pendingInstall.permissions.map((permission) => (
              <li key={permission}>{PERMISSION_LABELS[permission] ?? permission}</li>
            ))}
          </ul>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void closePendingInstall(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void closePendingInstall(true)}>
              {pendingInstall.signature?.status === 'unsigned' ? 'Enable anyway' : 'Enable plugin'}
            </Button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
