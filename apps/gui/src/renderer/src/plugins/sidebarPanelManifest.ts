import type { PluginManifest } from '@harborclient/core/plugin/types';

/**
 * Reads the optional `replaces` field from a sidebar panel manifest entry.
 *
 * Manifest is authoritative for replacement semantics; runtime registration
 * does not accept `replaces` from the plugin API.
 *
 * @param manifest - Plugin manifest that declared the contribution.
 * @param contributionId - Raw contribution id (matches `manifest.contributes.sidebarPanels[].id`).
 * @returns `"collections"` when the entry replaces the built-in Collections sidebar; otherwise `undefined`.
 */
export function getSidebarPanelReplaces(
  manifest: PluginManifest,
  contributionId: string
): 'collections' | undefined {
  const entry = manifest.contributes?.sidebarPanels?.find((panel) => panel.id === contributionId);
  return entry?.replaces === 'collections' ? 'collections' : undefined;
}
