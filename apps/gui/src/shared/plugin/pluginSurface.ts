/** Custom scheme used for isolated plugin webContents documents and assets. */
export const HARBOR_PLUGIN_PROTOCOL = 'harbor-plugin';

/** Contribution buckets that render inside plugin surface webviews. */
export type PluginContributionKind =
  | 'settingsSections'
  | 'sidebarPanels'
  | 'sidebarSections'
  | 'mainViews'
  | 'requestTabs'
  | 'responseTabs'
  | 'collectionSettingsTabs'
  | 'footerPanels'
  | 'statusBarItems'
  | 'modals';

/**
 * Builds the harbor-plugin agent shell URL for one plugin.
 *
 * @param pluginId - Plugin manifest id.
 */
export function buildPluginAgentUrl(pluginId: string): string {
  const params = new URLSearchParams({ role: 'agent' });
  return `${HARBOR_PLUGIN_PROTOCOL}://${encodeURIComponent(pluginId)}/shell.html?${params.toString()}`;
}

/**
 * Builds the harbor-plugin shell URL for one isolated plugin surface webview.
 *
 * @param pluginId - Plugin manifest id.
 * @param contributionId - Manifest contribution id.
 * @param kind - Contribution bucket key.
 * @param slot - Optional sub-slot within the contribution.
 */
export function buildPluginSurfaceUrl(
  pluginId: string,
  contributionId: string,
  kind: PluginContributionKind,
  slot: 'content' | 'headerActions' = 'content'
): string {
  const params = new URLSearchParams({
    role: 'view',
    contrib: contributionId,
    kind
  });
  if (slot !== 'content') {
    params.set('slot', slot);
  }
  return `${HARBOR_PLUGIN_PROTOCOL}://${encodeURIComponent(pluginId)}/shell.html?${params.toString()}`;
}
