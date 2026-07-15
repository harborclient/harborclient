import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { PageRef } from '#/renderer/src/store/tabs';
import { routePageMeta, type PageMetaContext } from '#/renderer/src/routing';

/**
 * Display metadata for a page tab in the tab bar.
 */
export interface PageTabDisplay {
  title: string;
  icon: IconDefinition;
}

/**
 * Optional resolved names for entity-specific page tabs.
 */
export type PageTabMetaOptions = PageMetaContext;

/**
 * Returns icon and title metadata for a configuration page tab.
 *
 * @param page - Page reference stored on the tab.
 * @param options - Optional resolved names for entity-specific pages.
 * @returns Title and icon for the tab bar.
 */
export function pageTabMeta(page: PageRef, options: PageTabMetaOptions = {}): PageTabDisplay {
  return routePageMeta(page, options);
}
