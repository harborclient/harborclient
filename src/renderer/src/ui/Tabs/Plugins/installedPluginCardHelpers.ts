import type { PluginInfo } from '#/shared/plugin/types';

/**
 * Middle footer action available for an installed plugin card.
 */
export type InstalledCardMiddleAction = 'update' | 'reload';

/**
 * Returns which middle footer action applies to an installed plugin, if any.
 *
 * Git installs can be updated from origin; unpacked dev loads can be reloaded.
 * File installs have no middle action.
 *
 * @param plugin - Installed plugin metadata row.
 * @returns "update", "reload", or null when no middle action applies.
 */
export function resolveInstalledCardMiddleAction(
  plugin: PluginInfo
): InstalledCardMiddleAction | null {
  if (plugin.source === 'git') {
    return 'update';
  }
  if (plugin.source === 'unpacked') {
    return 'reload';
  }
  return null;
}

/**
 * Returns the enable/disable toggle label for an installed plugin card footer.
 *
 * @param enabled - Whether the plugin is currently enabled.
 * @returns "Disable" or "Enable".
 */
export function installedCardToggleLabel(enabled: boolean): 'Disable' | 'Enable' {
  return enabled ? 'Disable' : 'Enable';
}
