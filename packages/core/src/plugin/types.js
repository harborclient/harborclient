/**
 * Namespaced settings section id for a plugin contribution.
 *
 * @param pluginId - Plugin manifest id.
 * @param sectionId - Contribution id from manifest.contributes.settingsSections.
 * @returns Stable section key for Settings navigation.
 */
export function pluginSettingsSectionId(pluginId, sectionId) {
    return pluginContributionId(pluginId, sectionId);
}
/**
 * Namespaced contribution id for plugin UI slots.
 *
 * @param pluginId - Plugin manifest id.
 * @param contributionId - Contribution id from the manifest.
 * @returns Stable namespaced id used as tab/section keys in the host UI.
 */
export function pluginContributionId(pluginId, contributionId) {
    return `plugin:${pluginId}:${contributionId}`;
}
/**
 * Parses a namespaced plugin settings section id.
 *
 * @param value - Settings section identifier.
 * @returns Plugin and section ids when the value is plugin-scoped.
 */
export function parsePluginSettingsSectionId(value) {
    const match = /^plugin:([^:]+):([^:]+)$/.exec(value);
    if (!match) {
        return null;
    }
    return { pluginId: match[1], sectionId: match[2] };
}
/**
 * Persisted plugin theme value stored via theme:get/set.
 *
 * @param pluginId - Plugin manifest id.
 * @param themeId - Theme id within the plugin.
 * @returns Serialized theme preference string.
 */
export function formatPluginThemeValue(pluginId, themeId) {
    return `plugin:${pluginId}:${themeId}`;
}
/**
 * Parses a persisted plugin theme preference.
 *
 * @param value - Raw theme setting from storage.
 * @returns Plugin and theme ids when the value is plugin-scoped.
 */
export function parsePluginThemeValue(value) {
    const match = /^plugin:([^:]+):([^:]+)$/.exec(value);
    if (!match) {
        return null;
    }
    return { pluginId: match[1], themeId: match[2] };
}
/**
 * Converts a persisted theme preference to the plugin {@link ActiveTheme} shape.
 *
 * @param theme - Raw theme setting from storage or IPC.
 * @returns Built-in or plugin-scoped active theme reference.
 */
export function toActiveTheme(theme) {
    const parsed = parsePluginThemeValue(theme);
    if (parsed) {
        return { source: 'plugin', pluginId: parsed.pluginId, themeId: parsed.themeId };
    }
    return { source: 'builtin', id: theme };
}
/**
 * Returns a stable string key for comparing {@link ActiveTheme} values.
 *
 * @param theme - Active theme reference.
 * @returns Serialized key suitable for deduplication.
 */
export function activeThemeKey(theme) {
    return theme.source === 'plugin'
        ? `plugin:${theme.pluginId}:${theme.themeId}`
        : `builtin:${theme.id}`;
}
//# sourceMappingURL=types.js.map