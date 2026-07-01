import { BackButton, Button, Page } from '@harborclient/sdk/components';
import { FaIcon } from '@harborclient/sdk/components';
import type { JSX, KeyboardEvent } from 'react';
import type { PluginCatalogEntry } from '#/shared/plugin/catalog';
import type { PluginInfo } from '#/shared/plugin/types';
import { faCircleCheck, faPuzzlePiece } from '#/renderer/src/fontawesome';
import { ErrorMessages } from './ErrorMessages';
import { isManagedInstall, resolveInstalledPluginSummary, stopRowActivation } from './helpers';
import { TableExternalLink } from './TableExternalLink';

/**
 * Fixed width for installed-plugin table action buttons so labels align.
 */
const PLUGIN_TABLE_ACTION_BUTTON_CLASS = 'w-[6rem]';

interface Props {
  /**
   * Closes the plugins view.
   */
  onClose: () => void;

  /**
   * Installed plugin rows from the main process.
   */
  plugins: PluginInfo[];

  /**
   * Whether the plugin list is loading.
   */
  loading: boolean;

  /**
   * Load error message, if any.
   */
  error: string | null;

  /**
   * Marketplace catalog entries keyed by plugin id for summary lookup.
   */
  catalogById: Map<string, PluginCatalogEntry>;

  /**
   * Plugin id currently being updated from git, if any.
   */
  gitUpdateBusyId: string | null;

  /**
   * Opens the detail view for one installed plugin.
   */
  onOpenDetail: (plugin: PluginInfo) => void;

  /**
   * Handles keyboard activation on a table row.
   */
  onRowKeyDown: (event: KeyboardEvent<HTMLTableRowElement>, plugin: PluginInfo) => void;

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
}

/**
 * Installed plugins table with enable, reload, update, and remove actions.
 */
export function InstalledView({
  onClose,
  plugins,
  loading,
  error,
  catalogById,
  gitUpdateBusyId,
  onOpenDetail,
  onRowKeyDown,
  onToggleEnabled,
  onReload,
  onUpdateFromGit,
  onRemove
}: Props): JSX.Element {
  return (
    <Page
      embedded
      title="Installed"
      icon={faPuzzlePiece}
      description="Enable, disable, update, and remove plugins installed on this machine."
      actions={<BackButton onClick={onClose} ariaLabel="Back to requests" />}
    >
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
                <th scope="col" className="w-0 whitespace-nowrap px-3 py-2 font-medium text-text">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {plugins.map((plugin) => {
                const gitUpdateBusy = gitUpdateBusyId === plugin.id;
                const summary = resolveInstalledPluginSummary(plugin, catalogById.get(plugin.id));

                return (
                  <tr
                    key={plugin.id}
                    tabIndex={0}
                    className="cursor-pointer border-b border-separator last:border-b-0 hover:bg-selection/40"
                    aria-label={`View details for ${plugin.name}`}
                    onClick={() => onOpenDetail(plugin)}
                    onKeyDown={(event) => onRowKeyDown(event, plugin)}
                  >
                    <td className="max-w-0 w-[40%] px-3 py-2 align-middle">
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
                      {summary ? (
                        <p className="m-0 min-w-0 truncate text-[14px] text-muted" title={summary}>
                          {summary}
                        </p>
                      ) : null}
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
                      <div className="flex flex-nowrap gap-2 justify-end">
                        <Button
                          type="button"
                          variant="secondary"
                          className={PLUGIN_TABLE_ACTION_BUTTON_CLASS}
                          aria-label={
                            plugin.enabled ? `Disable ${plugin.name}` : `Enable ${plugin.name}`
                          }
                          onClick={() => onToggleEnabled(plugin)}
                        >
                          {plugin.enabled ? 'Disable' : 'Enable'}
                        </Button>
                        {plugin.source === 'unpacked' ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className={PLUGIN_TABLE_ACTION_BUTTON_CLASS}
                            aria-label={`Reload ${plugin.name}`}
                            onClick={() => onReload(plugin)}
                          >
                            Reload
                          </Button>
                        ) : null}
                        {plugin.source === 'git' ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className={PLUGIN_TABLE_ACTION_BUTTON_CLASS}
                            disabled={gitUpdateBusy}
                            aria-label={`Update ${plugin.name}`}
                            onClick={() => onUpdateFromGit(plugin.id)}
                          >
                            {gitUpdateBusy ? 'Updating…' : 'Update'}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="primaryDanger"
                          className={PLUGIN_TABLE_ACTION_BUTTON_CLASS}
                          aria-label={
                            isManagedInstall(plugin)
                              ? `Uninstall ${plugin.name}`
                              : `Remove ${plugin.name}`
                          }
                          onClick={() => onRemove(plugin)}
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
    </Page>
  );
}
