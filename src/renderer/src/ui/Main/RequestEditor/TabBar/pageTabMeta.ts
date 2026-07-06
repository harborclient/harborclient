import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { SettingsSection } from '#/shared/types';
import type { PageRef } from '#/renderer/src/store/drafts';
import {
  faCookieBite,
  faFingerprint,
  faGear,
  faGlobe,
  faDatabase,
  faPalette,
  faPuzzlePiece,
  faTerminal,
  faUsers
} from '#/renderer/src/fontawesome';
import { settingsSectionMeta } from '#/renderer/src/ui/Settings/constants';

/**
 * Display metadata for a page tab in the tab bar.
 */
export interface PageTabDisplay {
  title: string;
  icon: IconDefinition;
}

interface PageTabMetaOptions {
  /** Collection name when the page is collection settings. */
  collectionName?: string;
  /** Environment name when the page is environment settings. */
  environmentName?: string;
  /** Plugin view title when the page is a plugin main view. */
  pluginTitle?: string;
}

/**
 * Returns icon and title metadata for a configuration page tab.
 *
 * @param page - Page reference stored on the tab.
 * @param options - Optional resolved names for entity-specific pages.
 * @returns Title and icon for the tab bar.
 */
export function pageTabMeta(page: PageRef, options: PageTabMetaOptions = {}): PageTabDisplay {
  switch (page.type) {
    case 'settings': {
      if (page.section.startsWith('plugin:')) {
        return { title: 'Settings', icon: faGear };
      }
      try {
        const meta = settingsSectionMeta(page.section as SettingsSection);
        return { title: meta.label, icon: meta.icon };
      } catch {
        return { title: 'Settings', icon: faGear };
      }
    }
    case 'plugins':
      return { title: 'Plugins', icon: faPuzzlePiece };
    case 'themes':
      return { title: 'Themes', icon: faPalette };
    case 'cookies':
      return { title: 'Cookies', icon: faCookieBite };
    case 'snippets':
      return { title: 'Snippets', icon: faTerminal };
    case 'team-hubs':
      return { title: 'Team Hub', icon: faUsers };
    case 'sharing-keys':
      return { title: 'Sharing Keys', icon: faFingerprint };
    case 'plugin-view':
      return { title: options.pluginTitle ?? 'Plugin', icon: faPuzzlePiece };
    case 'collection':
      return { title: options.collectionName ?? 'Collection', icon: faDatabase };
    case 'environment':
      return { title: options.environmentName ?? 'Environment', icon: faGlobe };
  }
}
