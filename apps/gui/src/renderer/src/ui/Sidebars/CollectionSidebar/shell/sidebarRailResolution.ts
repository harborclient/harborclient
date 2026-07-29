import type { RegisteredSidebarRailItem } from '@harborclient/core/plugin/types';
import type { SidebarRailItemData } from '@harborclient/sdk/components';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

/**
 * Resolves which registered activity-rail item should mount in the sidebar body.
 *
 * Stale ids that no longer match a registered contribution return `null` so the
 * host can fall through to switcher panels or the built-in accordion.
 *
 * @param items - Registered sidebar rail item contributions.
 * @param activeId - Redux `activeSidebarRailItemId` (namespaced contribution id).
 * @returns The matching rail item, or `null` when none is active.
 */
export function resolveActiveSidebarRailItem(
  items: RegisteredSidebarRailItem[],
  activeId: string | null
): RegisteredSidebarRailItem | null {
  if (activeId == null) {
    return null;
  }
  return items.find((item) => item.id === activeId) ?? null;
}

/**
 * Builds activity-rail item data by appending sorted plugin contributions after
 * the host's built-in modes.
 *
 * @param builtIn - Host-owned rail destinations (Collections, Environments, …).
 * @param pluginItems - Registered plugin rail contributions (already order-sorted).
 * @param resolveIcon - Maps a curated icon name to a Font Awesome definition.
 * @returns Combined rail items for {@link SidebarRail}.
 */
export function mergeSidebarRailItems(
  builtIn: SidebarRailItemData[],
  pluginItems: RegisteredSidebarRailItem[],
  resolveIcon: (name: string | undefined) => IconDefinition
): SidebarRailItemData[] {
  const pluginRailItems: SidebarRailItemData[] = pluginItems.map((item) => ({
    id: item.id,
    icon: resolveIcon(item.icon),
    label: item.title
  }));
  return [...builtIn, ...pluginRailItems];
}

/**
 * Derives chrome visibility for the sidebar search strip and activity rail.
 *
 * Switcher-based `sidebarPanels` still hide both chrome pieces. Plugin rail
 * items keep the rail visible and hide only the host search strip.
 *
 * @param switcherDisplayedPanel - Whether a switcher sidebar panel body is shown.
 * @param activeRailItem - Whether a plugin rail item body is shown.
 * @returns Flags for search and rail visibility.
 */
export function resolveSidebarChromeVisibility(
  switcherDisplayedPanel: boolean,
  activeRailItem: boolean
): { showSearch: boolean; showRail: boolean } {
  if (activeRailItem) {
    return { showSearch: false, showRail: true };
  }
  if (switcherDisplayedPanel) {
    return { showSearch: false, showRail: false };
  }
  return { showSearch: true, showRail: true };
}
