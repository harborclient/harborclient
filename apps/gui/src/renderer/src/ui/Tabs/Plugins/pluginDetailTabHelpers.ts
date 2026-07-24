import type { PluginCatalogEntry } from '#/shared/plugin/catalog';
import type { PluginInfo } from '#/shared/plugin/types';
import { formatThemeDisplayName } from '#/shared/plugin/themeCategory';
import type { AppDispatch } from '#/renderer/src/store/redux';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';
import type { PluginManagementKind } from './constants';
import { findInstalledCatalogPlugin } from './helpers';

/**
 * Opens or focuses a tab showing one installed plugin or theme.
 *
 * @param dispatch - Redux dispatch function.
 * @param kind - Whether the item is managed as a plugin or theme.
 * @param plugin - Installed plugin row to inspect.
 */
export function openInstalledPluginDetailTab(
  dispatch: AppDispatch,
  kind: PluginManagementKind,
  plugin: PluginInfo
): void {
  dispatch(
    openPageTab({
      type: 'plugin-detail',
      kind,
      source: 'installed',
      id: plugin.id,
      label: kind === 'themes' ? formatThemeDisplayName(plugin.name) : plugin.name
    })
  );
}

/**
 * Opens or focuses a tab for a marketplace plugin listing, redirecting to the
 * installed tab when the catalog id is already present locally.
 *
 * @param dispatch - Redux dispatch function.
 * @param kind - Whether the listing is managed as a plugin or theme.
 * @param entry - Marketplace listing to inspect.
 * @param plugins - Installed plugin rows used to detect an existing install.
 */
export function openCatalogPluginDetailTab(
  dispatch: AppDispatch,
  kind: PluginManagementKind,
  entry: PluginCatalogEntry,
  plugins: PluginInfo[]
): void {
  const installed = findInstalledCatalogPlugin(plugins, entry.id);
  if (installed) {
    openInstalledPluginDetailTab(dispatch, kind, installed);
    return;
  }

  dispatch(
    openPageTab({
      type: 'plugin-detail',
      kind,
      source: 'catalog',
      id: entry.id,
      label: kind === 'themes' ? formatThemeDisplayName(entry.name) : entry.name
    })
  );
}
