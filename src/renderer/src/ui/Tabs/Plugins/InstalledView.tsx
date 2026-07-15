import { FormGroup, Input, Page } from '@harborclient/sdk/components';
import { useMemo, type JSX } from 'react';
import type { PluginCatalogEntry } from '#/shared/plugin/catalog';
import type { PluginInfo } from '#/shared/plugin/types';
import type { CustomTheme } from '#/shared/types/customTheme';
import type { ThemeSource } from '#/shared/types';
import { faPalette, faPuzzlePiece } from '#/renderer/src/fontawesome';
import type { PluginManagementKind } from '#/renderer/src/ui/Tabs/Plugins/constants';
import { CustomThemeCard } from './CustomThemeCard';
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

  /**
   * Saved custom themes shown above installed theme plugins.
   */
  customThemes?: CustomTheme[];

  /**
   * Whether custom themes are loading.
   */
  customThemesLoading?: boolean;

  /**
   * Currently active appearance theme preference.
   */
  activeTheme?: ThemeSource;

  /**
   * Opens one custom theme in the Designer for editing.
   */
  onEditCustomTheme?: (id: string) => void;

  /**
   * Deletes one custom theme after confirmation.
   */
  onDeleteCustomTheme?: (theme: CustomTheme) => void;

  /**
   * Restores one built-in theme to its packaged canonical palette.
   */
  onRestoreBuiltinTheme?: (theme: CustomTheme) => void;

  /**
   * Refreshes the custom theme list after Use/delete actions.
   */
  onCustomThemesChanged?: () => void;

  /**
   * Switches to a theme plugin from the Installed themes page.
   */
  onUsePluginTheme?: (plugin: PluginInfo) => void;
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
  onRemove,
  customThemes = [],
  customThemesLoading = false,
  activeTheme = 'system',
  onEditCustomTheme,
  onDeleteCustomTheme,
  onRestoreBuiltinTheme,
  onCustomThemesChanged,
  onUsePluginTheme
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

  /**
   * Filters saved custom themes using the same search query as installed plugins.
   */
  const filteredCustomThemes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return customThemes;
    }
    return customThemes.filter((theme) => theme.title.toLowerCase().includes(query));
  }, [customThemes, searchQuery]);

  return (
    <Page
      embedded
      title={title}
      icon={isThemes ? faPalette : faPuzzlePiece}
      description={
        isThemes
          ? 'Switch to, update, and remove theme plugins installed on this machine.'
          : 'Enable, disable, update, and remove plugins installed on this machine.'
      }
    >
      <div className="mb-4">
        <FormGroup bordered={false} label={searchLabel} htmlFor={searchId} srOnly>
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

      {!loading && plugins.length === 0 && (!isThemes || customThemes.length === 0) ? (
        <p className="text-muted">{emptyLabel}</p>
      ) : null}

      {isThemes && customThemesLoading ? (
        <p className="text-muted" role="status">
          Loading custom themes…
        </p>
      ) : null}

      {isThemes && !customThemesLoading && filteredCustomThemes.length > 0 ? (
        <div className="mb-6">
          <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4">
            {filteredCustomThemes.map((theme) => (
              <CustomThemeCard
                key={theme.id}
                theme={theme}
                activeTheme={activeTheme}
                onEdit={(id) => onEditCustomTheme?.(id)}
                onDelete={(entry) => onDeleteCustomTheme?.(entry)}
                onRestore={(entry) => onRestoreBuiltinTheme?.(entry)}
                onThemesChanged={() => onCustomThemesChanged?.()}
              />
            ))}
          </ul>
        </div>
      ) : null}

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
              onUseTheme={onUsePluginTheme}
              activeTheme={activeTheme}
            />
          ))}
        </ul>
      ) : null}
    </Page>
  );
}
