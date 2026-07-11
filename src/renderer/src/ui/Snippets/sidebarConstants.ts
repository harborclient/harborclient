import { faCode, faDownload, faStore } from '#/renderer/src/fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { SnippetsSidebarSection } from './sidebarTypes';

/**
 * Sidebar navigation entries for the Snippets screen.
 */
export const SNIPPET_SECTIONS: Array<{
  value: SnippetsSidebarSection;
  label: string;
  icon: IconDefinition;
}> = [
  { value: 'installed', label: 'Installed', icon: faCode },
  { value: 'marketplace', label: 'Marketplace', icon: faStore },
  { value: 'install', label: 'Install', icon: faDownload }
];
