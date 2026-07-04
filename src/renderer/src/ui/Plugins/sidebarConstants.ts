import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faDownload, faGear, faPuzzlePiece, faStore } from '#/renderer/src/fontawesome';
import type { PluginManagementKind } from './constants';
import type { PluginsSidebarSection } from './sidebarTypes';

/**
 * Sidebar navigation entries for the Plugins screen (order, labels, and icons).
 */
export const PLUGIN_SECTIONS: Array<{
  value: PluginsSidebarSection;
  label: string;
  icon: IconDefinition;
}> = [
  { value: 'installed', label: 'Installed', icon: faPuzzlePiece },
  { value: 'marketplace', label: 'Marketplace', icon: faStore },
  { value: 'install', label: 'Install', icon: faDownload },
  { value: 'settings', label: 'Settings', icon: faGear }
];

/**
 * Returns sidebar entries for the Plugins or Themes management screen.
 *
 * Themes omit Settings because catalog and source configuration is shared with
 * the Plugins tab.
 *
 * @param kind - Whether the screen manages plugins or themes.
 * @returns Sidebar items in display order.
 */
export function pluginSidebarSections(kind: PluginManagementKind): Array<{
  value: PluginsSidebarSection;
  label: string;
  icon: IconDefinition;
}> {
  if (kind === 'themes') {
    return PLUGIN_SECTIONS.filter((item) => item.value !== 'settings');
  }
  return PLUGIN_SECTIONS;
}
