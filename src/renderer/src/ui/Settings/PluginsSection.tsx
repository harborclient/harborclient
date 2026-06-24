import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { PluginCatalog, PluginCatalogEntry } from '#/shared/plugin/catalog';
import type { PluginInfo, PluginPermission } from '#/shared/plugin/types';
import { Button } from '#/renderer/src/components/Button';
import { Input } from '#/renderer/src/components/forms';
import { Modal } from '#/renderer/src/components/Modal';
import {
  SegmentedTabPanel,
  SegmentedTabs,
  SegmentedTabsGroup
} from '#/renderer/src/components/SegmentedTabs';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { showConfirm } from '#/renderer/src/ui/modals/dialogHelpers';

const PERMISSION_LABELS: Record<PluginPermission, string> = {
  ui: 'UI contributions (settings, themes, toasts, commands)',
  storage: 'Plugin-scoped persistent storage',
  'filesystem:pick': 'Open/save dialogs for user-selected paths',
  'filesystem:read': 'Read from allowlisted filesystem paths',
  'filesystem:write': 'Write to allowlisted filesystem paths',
  http: 'HTTP request hooks in the main process',
  ipc: 'Custom IPC between renderer and main plugin halves'
};

/**
 * Returns whether a plugin is installed under userData (file or git), not dev-unpacked.
 *
 * @param plugin - Plugin metadata row.
 */
function isManagedInstall(plugin: PluginInfo): boolean {
  return plugin.source === 'installed' || plugin.source === 'git';
}

type PluginsViewMode = 'installed' | 'browse';

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
 * Settings section for installing, enabling, and inspecting plugins.
 */
export function PluginsSection(): JSX.Element {
  const dispatch = useAppDispatch();
  const [viewMode, setViewMode] = useState<PluginsViewMode>('installed');
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [catalog, setCatalog] = useState<PluginCatalog | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogActionBusyId, setCatalogActionBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingInstall, setPendingInstall] = useState<PluginInfo | null>(null);
  const [descriptionMarkdown, setDescriptionMarkdown] = useState<string>('');
  const [showGitInstallModal, setShowGitInstallModal] = useState(false);
  const [gitInstallUrl, setGitInstallUrl] = useState('');
  const [gitInstallRef, setGitInstallRef] = useState('');
  const [gitInstallError, setGitInstallError] = useState<string | null>(null);
  const [gitInstallBusy, setGitInstallBusy] = useState(false);
  const [gitUpdateBusy, setGitUpdateBusy] = useState(false);

  const selected = useMemo(
    () => plugins.find((plugin) => plugin.id === selectedId) ?? null,
    [plugins, selectedId]
  );

  /**
   * Loads the plugin list from the main process.
   */
  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const next = await window.api.listPlugins();
      setPlugins(next);
      if (selectedId && !next.some((plugin) => plugin.id === selectedId)) {
        setSelectedId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

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
   * Loads the selected plugin description markdown when detail view opens.
   */
  useEffect(() => {
    let active = true;
    const descriptionPath = selected?.manifest.description;
    if (!selected || !descriptionPath) {
      return () => {
        active = false;
      };
    }
    void window.api
      .readPluginAsset(selected.id, descriptionPath)
      .then((asset) => {
        if (active) {
          setDescriptionMarkdown(atob(asset.content));
        }
      })
      .catch(() => {
        if (active) {
          setDescriptionMarkdown('');
        }
      });
    return () => {
      active = false;
    };
  }, [selected]);

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
   * Switches plugin settings views and lazily loads the marketplace catalog.
   *
   * @param mode - Selected plugins view.
   */
  const handleViewModeChange = (mode: PluginsViewMode): void => {
    setViewMode(mode);
    if (mode === 'browse' && !catalog && !catalogLoading) {
      void loadCatalog();
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
    } else {
      await window.api.setPluginEnabled(plugin.id, true);
    }
    await refresh();
    if (keep) {
      setSelectedId(plugin.id);
    }
  };

  /**
   * Opens the install-from-file dialog and shows the permissions modal.
   */
  const handleInstall = async (): Promise<void> => {
    setError(null);
    try {
      const installed = await window.api.installPlugin();
      if (installed) {
        setPendingInstall(installed);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
    setError(null);
    try {
      const ref = gitInstallRef.trim() || undefined;
      const installed = await window.api.installPluginFromGit(url, ref);
      setShowGitInstallModal(false);
      setPendingInstall(installed);
    } catch (err) {
      setGitInstallError(err instanceof Error ? err.message : String(err));
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
    setGitUpdateBusy(true);
    setError(null);
    try {
      await window.api.updatePluginFromGit(pluginId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGitUpdateBusy(false);
    }
  };

  /**
   * Installs a marketplace plugin via the existing git clone flow.
   *
   * @param entry - Catalog listing to install.
   */
  const handleCatalogInstall = async (entry: PluginCatalogEntry): Promise<void> => {
    setCatalogActionBusyId(entry.id);
    setCatalogError(null);
    setError(null);
    try {
      const installed = await window.api.installPluginFromGit(entry.repoUrl, entry.ref);
      setPendingInstall(installed);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : String(err));
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
    setCatalogError(null);
    setError(null);
    try {
      await window.api.updatePluginFromGit(pluginId);
      await refresh();
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : String(err));
    } finally {
      setCatalogActionBusyId(null);
    }
  };

  /**
   * Opens the load-unpacked dialog and shows the permissions modal.
   */
  const handleLoadUnpacked = async (): Promise<void> => {
    setError(null);
    try {
      const loaded = await window.api.loadUnpackedPlugin();
      if (loaded) {
        setPendingInstall(loaded);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
   * @param pluginId - Plugin manifest id.
   */
  const handleReload = async (pluginId: string): Promise<void> => {
    await window.api.reloadPlugin(pluginId);
    await refresh();
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
    if (selectedId === plugin.id) {
      setSelectedId(null);
    }
    await refresh();
  };

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="m-0 flex-1 text-[15px] font-semibold text-text">Plugins</h2>
        {viewMode === 'installed' ? (
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

      <SegmentedTabsGroup
        value={viewMode}
        onChange={handleViewModeChange}
        ariaLabel="Plugin settings views"
      >
        <SegmentedTabs
          fullWidth
          tabs={[
            { value: 'installed', label: 'Installed' },
            { value: 'browse', label: 'Browse plugins' }
          ]}
        />

        <SegmentedTabPanel value="installed" className="pt-4">
          {error ? <p className="text-danger">{error}</p> : null}
          {loading ? (
            <p className="text-muted" role="status">
              Loading plugins…
            </p>
          ) : null}

          {!loading && plugins.length === 0 ? (
            <p className="text-muted">No plugins installed yet.</p>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <ul className="m-0 list-none space-y-2 p-0">
              {plugins.map((plugin) => (
                <li key={plugin.id}>
                  <button
                    type="button"
                    className={`w-full rounded-md border px-3 py-2 text-left ${
                      selectedId === plugin.id
                        ? 'border-accent bg-selection'
                        : 'border-separator bg-control'
                    }`}
                    onClick={() => setSelectedId(plugin.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-text">{plugin.name}</span>
                      {plugin.source === 'unpacked' ? (
                        <span className="rounded bg-info/20 px-1.5 py-0.5 text-[11px] text-text">
                          Development
                        </span>
                      ) : null}
                      {plugin.source === 'git' ? (
                        <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[11px] text-text">
                          Git
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[12px] text-muted">
                      {plugin.version} · {plugin.id}
                    </div>
                    {plugin.error ? (
                      <div className="text-[12px] text-danger">{plugin.error}</div>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>

            {selected ? (
              <div className="rounded-md border border-separator bg-control p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h3 className="m-0 flex-1 text-[15px] font-semibold text-text">
                    {selected.name}
                  </h3>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleToggleEnabled(selected)}
                  >
                    {selected.enabled ? 'Disable' : 'Enable'}
                  </Button>
                  {selected.source === 'unpacked' ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void handleReload(selected.id)}
                    >
                      Reload
                    </Button>
                  ) : null}
                  {selected.source === 'git' ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={gitUpdateBusy}
                      onClick={() => void handleUpdateFromGit(selected.id)}
                    >
                      {gitUpdateBusy ? 'Updating…' : 'Update'}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="primaryDanger"
                    onClick={() => void handleRemove(selected)}
                  >
                    {isManagedInstall(selected) ? 'Uninstall' : 'Remove'}
                  </Button>
                </div>

                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
                  <dt className="text-muted">Version</dt>
                  <dd className="m-0 text-text">{selected.version}</dd>
                  <dt className="text-muted">Publisher</dt>
                  <dd className="m-0 text-text">{selected.manifest.company ?? '—'}</dd>
                  <dt className="text-muted">Source</dt>
                  <dd className="m-0 break-all text-text">{selected.path}</dd>
                  {selected.repoUrl ? (
                    <>
                      <dt className="text-muted">Repository</dt>
                      <dd className="m-0 break-all text-text">
                        <a
                          href={selected.repoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent"
                        >
                          {selected.repoUrl}
                        </a>
                        {selected.repoRef ? (
                          <span className="text-muted">{` (${selected.repoRef})`}</span>
                        ) : null}
                      </dd>
                    </>
                  ) : null}
                </dl>

                <div className="mt-3 flex flex-wrap gap-3 text-[13px]">
                  {selected.manifest.homepage ? (
                    <a
                      href={selected.manifest.homepage}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent"
                    >
                      Website
                    </a>
                  ) : null}
                  {selected.manifest.bugs?.url ? (
                    <a
                      href={selected.manifest.bugs.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent"
                    >
                      Report issue
                    </a>
                  ) : null}
                </div>

                <div className="mt-4 border-t border-separator pt-4">
                  <h4 className="m-0 mb-2 text-[14px] font-medium text-text">Permissions</h4>
                  <ul className="m-0 list-disc pl-5 text-[13px] text-text">
                    {selected.permissions.map((permission) => (
                      <li key={permission}>{PERMISSION_LABELS[permission] ?? permission}</li>
                    ))}
                  </ul>
                </div>

                {selected.manifest.description ? (
                  <div className="prose prose-sm mt-4 max-w-none border-t border-separator pt-4 text-text">
                    {descriptionMarkdown ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {descriptionMarkdown}
                      </ReactMarkdown>
                    ) : (
                      <p className="text-muted">Loading description…</p>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </SegmentedTabPanel>

        <SegmentedTabPanel value="browse" className="pt-4">
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

          {!catalogLoading && catalog && catalog.plugins.length > 0 ? (
            <ul className="m-0 list-none space-y-3 p-0">
              {catalog.plugins.map((entry) => {
                const installed = findInstalledCatalogPlugin(plugins, entry.id);
                const actionBusy = catalogActionBusyId === entry.id;

                return (
                  <li key={entry.id} className="rounded-md border border-separator bg-control p-4">
                    <div className="flex flex-wrap items-start gap-3">
                      {entry.icon ? (
                        <img
                          src={entry.icon}
                          alt=""
                          className="h-10 w-10 rounded-md border border-separator object-cover"
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="m-0 text-[15px] font-semibold text-text">{entry.name}</h3>
                          <span className="text-[12px] text-muted">{entry.author}</span>
                        </div>
                        <p className="mb-2 mt-1 text-[13px] text-text">{entry.summary}</p>
                        <div className="flex flex-wrap gap-2 text-[12px] text-muted">
                          {entry.categories.map((category) => (
                            <span key={category} className="rounded bg-panel px-2 py-0.5 text-text">
                              {category}
                            </span>
                          ))}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-[13px]">
                          <a
                            href={entry.repoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-accent"
                          >
                            View on GitHub
                          </a>
                          {entry.homepage ? (
                            <a
                              href={entry.homepage}
                              target="_blank"
                              rel="noreferrer"
                              className="text-accent"
                            >
                              Website
                            </a>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-2">
                        {installed ? (
                          installed.source === 'git' ? (
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={actionBusy}
                              aria-label={`Update ${entry.name}`}
                              onClick={() => void handleCatalogUpdate(installed.id)}
                            >
                              {actionBusy ? 'Updating…' : 'Update'}
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="secondary"
                              disabled
                              aria-label={`${entry.name} is installed`}
                            >
                              Installed
                            </Button>
                          )
                        ) : (
                          <Button
                            type="button"
                            disabled={actionBusy}
                            aria-label={`Install ${entry.name}`}
                            onClick={() => void handleCatalogInstall(entry)}
                          >
                            {actionBusy ? 'Installing…' : 'Install'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </SegmentedTabPanel>
      </SegmentedTabsGroup>

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
          <label htmlFor="plugin-git-install-url" className="mb-1 block text-[13px] text-muted">
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
          <label htmlFor="plugin-git-install-ref" className="mb-1 block text-[13px] text-muted">
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
              Enable plugin
            </Button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
