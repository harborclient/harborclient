import type { PluginInfo } from '#/shared/plugin/types';

/**
 * Returns whether a plugin is installed under userData (file or git), not dev-unpacked.
 *
 * @param plugin - Plugin metadata row.
 */
export function isManagedInstall(plugin: PluginInfo): boolean {
  return plugin.source === 'installed' || plugin.source === 'git';
}

/**
 * Returns the installed plugin row matching a catalog entry id, if any.
 *
 * @param plugins - Installed plugin rows from the main process.
 * @param entryId - Catalog manifest id.
 */
export function findInstalledCatalogPlugin(
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
export function stopRowActivation(event: { stopPropagation(): void }): void {
  event.stopPropagation();
}

/**
 * Validates a plugin source URL before it is added to the draft settings.
 *
 * @param url - Raw URL from the add-endpoint input.
 * @returns Trimmed URL when valid.
 */
export function parseDraftPluginSourceUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error('URL is required.');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Enter a valid http:// or https:// URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Enter a valid http:// or https:// URL.');
  }

  return trimmed;
}
