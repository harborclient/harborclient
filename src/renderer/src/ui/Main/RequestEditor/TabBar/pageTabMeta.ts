import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { SettingsSection } from '#/shared/types';
import type { PageRef } from '#/renderer/src/store/tabs';
import {
  faBook,
  faCookieBite,
  faFingerprint,
  faGear,
  faGlobe,
  faDatabase,
  faFolder,
  faPalette,
  faPlay,
  faPuzzlePiece,
  faCode,
  faCodeBranch,
  faUsers
} from '#/renderer/src/fontawesome';
import { settingsSectionMeta } from '#/renderer/src/ui/Tabs/Settings/constants';

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
  /** Folder name when the page is folder settings. */
  folderName?: string;
  /** Plugin view title when the page is a plugin main view. */
  pluginTitle?: string;
  /** Team hub name when the page is team hub admin. */
  teamHubName?: string;
  /** Primary run target label when the page is the collection runner. */
  runnerTargetName?: string;
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
    case 'getting-started':
      return { title: 'Getting Started', icon: faBook };
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
      return { title: 'Snippets', icon: faCode };
    case 'team-hubs':
      return { title: 'Team Hub', icon: faUsers };
    case 'team-hub-admin':
      return { title: options.teamHubName ?? 'Untitled', icon: faUsers };
    case 'sharing-keys':
      return { title: 'Sharing Keys', icon: faFingerprint };
    case 'hosted-main-view':
      return { title: options.pluginTitle ?? 'Plugin', icon: faPuzzlePiece };
    case 'collection':
      return { title: options.collectionName ?? 'Collection', icon: faDatabase };
    case 'folder':
      return { title: options.folderName ?? 'Folder', icon: faFolder };
    case 'environment':
      return { title: options.environmentName ?? 'Environment', icon: faGlobe };
    case 'collection-runner':
      return {
        title: options.runnerTargetName ? `Run ${options.runnerTargetName}` : 'Runner',
        icon: faPlay
      };
    case 'plugin-detail':
      return {
        title: page.label,
        icon: page.kind === 'themes' ? faPalette : faPuzzlePiece
      };
    case 'snippet-detail':
    case 'snippet-edit':
    case 'script-editor':
      return { title: page.label, icon: faCode };
    case 'merge-editor':
      return { title: page.label, icon: faCodeBranch };
  }
}
