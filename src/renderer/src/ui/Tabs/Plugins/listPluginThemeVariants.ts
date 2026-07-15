import type { PluginInfo, RegisteredPluginTheme } from '#/shared/plugin/types';

/**
 * One selectable theme variant contributed by an installed theme plugin.
 */
export interface PluginThemeVariant {
  /** Theme id within the plugin manifest. */
  id: string;

  /** Human-readable variant title. */
  title: string;

  /** Built-in appearance family this variant belongs to. */
  type: 'light' | 'dark' | 'high-contrast';
}

/**
 * Lists theme variants for one plugin, preferring live registry entries over manifest
 * declarations when the plugin is enabled.
 *
 * @param plugin - Installed theme plugin row.
 * @param registeredThemes - Currently registered plugin themes from the renderer registry.
 * @returns Variants in registration or manifest order, or an empty array when none exist.
 */
export function listPluginThemeVariants(
  plugin: PluginInfo,
  registeredThemes: RegisteredPluginTheme[]
): PluginThemeVariant[] {
  const registered = registeredThemes
    .filter((entry) => entry.pluginId === plugin.id)
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      type: entry.type
    }));

  if (registered.length > 0) {
    return registered;
  }

  const manifestThemes = plugin.manifest.contributes?.themes ?? [];
  return manifestThemes.map((entry) => ({
    id: entry.id,
    title: entry.title,
    type: entry.type
  }));
}
