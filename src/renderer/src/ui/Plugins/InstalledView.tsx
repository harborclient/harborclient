import { FormGroup, Input, Page } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { PluginCatalogEntry } from '#/shared/plugin/catalog';
import type { PluginInfo } from '#/shared/plugin/types';
import { faPalette, faPuzzlePiece } from '#/renderer/src/fontawesome';
import type { PluginManagementKind } from '#/renderer/src/ui/Plugins/constants';
import { InstalledPluginCard } from './InstalledPluginCard';

interface Props {
  /**
   * Whether this list shows plugins or themes.
   */
  kind: PluginManagementKind;

  /**
   * Installed plugin rows from the main process.
   */
  plugins: PluginInfo[];

  /**
   * Installed plugin rows after search filtering.
   */
  filteredPlugins: PluginInfo[];

  /**
   * Current search query for filtering installed entries.
   */
  searchQuery: string;

  /**
   * Updates the installed search query.
   */
  onSearchQueryChange: (query: string) => void;

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
 * Installed plugins or themes grid with enable, reload, update, and remove actions.
 */
export function InstalledView({
  kind,
  plugins,
  filteredPlugins,
  searchQuery,
  onSearchQueryChange,
  loading,
  error,
  catalogById,
  gitUpdateBusyId,
  onOpenDetail,
  onToggleEnabled,
  onReload,
  onUpdateFromGit,
  onRemove
}: Props): JSX.Element {
  const isThemes = kind === 'themes';
  const title = isThemes ? 'Installed themes' : 'Installed';
  const emptyLabel = isThemes ? 'No themes installed yet.' : 'No plugins installed yet.';
  const loadingLabel = isThemes ? 'Loading themes…' : 'Loading plugins…';
  const searchId = isThemes ? 'theme-installed-search' : 'plugin-installed-search';
  const searchLabel = isThemes ? 'Search installed themes' : 'Search installed plugins';
  const searchPlaceholder = isThemes ? 'Search installed themes' : 'Search installed plugins';
  const noMatchLabel = isThemes
    ? 'No installed themes match your search.'
    : 'No installed plugins match your search.';

  return (
    <Page
      embedded
      title={title}
      icon={isThemes ? faPalette : faPuzzlePiece}
      description={
        isThemes
          ? 'Enable, disable, update, and remove theme plugins installed on this machine.'
          : 'Enable, disable, update, and remove plugins installed on this machine.'
      }
    >
      <div className="mb-4">
        <FormGroup className="border-none! p-0!" label={searchLabel} htmlFor={searchId} srOnly>
          <Input
            id={searchId}
            type="search"
            placeholder={searchPlaceholder}
            value={searchQuery}
            disabled={loading}
            className="w-full max-w-md"
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
        </FormGroup>
      </div>

      {error ? <p className="text-danger">{error}</p> : null}
      {loading ? (
        <p className="text-muted" role="status">
          {loadingLabel}
        </p>
      ) : null}

      {!loading && plugins.length === 0 ? <p className="text-muted">{emptyLabel}</p> : null}

      {!loading && plugins.length > 0 && filteredPlugins.length === 0 ? (
        <p className="text-muted" role="status">
          {noMatchLabel}
        </p>
      ) : null}

      {!loading && filteredPlugins.length > 0 ? (
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4">
          {filteredPlugins.map((plugin) => (
            <InstalledPluginCard
              key={plugin.id}
              kind={kind}
              plugin={plugin}
              catalogEntry={catalogById.get(plugin.id)}
              gitUpdateBusy={gitUpdateBusyId === plugin.id}
              onOpenDetail={onOpenDetail}
              onToggleEnabled={onToggleEnabled}
              onReload={onReload}
              onUpdateFromGit={onUpdateFromGit}
              onRemove={onRemove}
            />
          ))}
        </ul>
      ) : null}
    </Page>
  );
}
