import type { ComponentType, LazyExoticComponent } from 'react';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { PageRef } from '#/renderer/src/store/tabs';

/**
 * Narrows {@link PageRef} to a single discriminant.
 */
export type PageOf<T extends PageRef['type']> = Extract<PageRef, { type: T }>;

/**
 * Props passed to every page route component by the tab content host.
 */
export interface PageComponentProps<T extends PageRef['type'] = PageRef['type']> {
  /**
   * Typed page identity for this route.
   */
  page: PageOf<T>;

  /**
   * Hosting tab id (close, dirty prompts, remount).
   */
  tabId: string;
}

/**
 * Resolved display names and labels for tab chrome and close prompts.
 */
export interface PageMetaContext {
  /**
   * Collection name when the page is collection settings.
   */
  collectionName?: string;

  /**
   * Environment name when the page is environment settings.
   */
  environmentName?: string;

  /**
   * Folder name when the page is folder settings.
   */
  folderName?: string;

  /**
   * Plugin view title when the page is a plugin main view.
   */
  pluginTitle?: string;

  /**
   * Team hub name when the page is team hub admin.
   */
  teamHubName?: string;

  /**
   * Primary run target label when the page is the collection runner.
   */
  runnerTargetName?: string;
}

/**
 * Navigation state flags used to detect dirty page tabs on close.
 */
export type PageDirtyFlag = 'collection' | 'environment' | 'folder';

/**
 * Declarative route entry for one {@link PageRef} type.
 */
export interface PageRoute<T extends PageRef['type']> {
  /**
   * Stable dedupe key used to find an existing page tab.
   *
   * @param page - Page identity to key.
   * @returns Stable string key.
   */
  key: (page: PageOf<T>) => string;

  /**
   * Tab title and icon for the tab bar.
   *
   * @param page - Page identity stored on the tab.
   * @param ctx - Optional resolved entity names.
   * @returns Title and icon for the tab bar.
   */
  meta: (page: PageOf<T>, ctx: PageMetaContext) => { title: string; icon: IconDefinition };

  /**
   * Lazy page component rendered for this route.
   */
  Component: LazyExoticComponent<ComponentType<PageComponentProps<T>>>;

  /**
   * Human-readable name for unsaved-close prompts.
   * Defaults to {@link PageRoute.meta} title when omitted.
   *
   * @param page - Page identity for the tab being closed.
   * @param ctx - Optional resolved entity names.
   * @returns Display name for the confirmation dialog.
   */
  closeName?: (page: PageOf<T>, ctx: PageMetaContext) => string;

  /**
   * Which navigation dirty flag applies when closing this page tab.
   */
  dirtyFlag?: PageDirtyFlag;

  /**
   * When true, reopening updates the existing tab's page payload in place.
   */
  replaceOnReopen?: boolean;

  /**
   * Salvages a persisted page object into a typed page ref, or null to drop.
   *
   * @param value - Candidate page object from persisted storage.
   * @returns Valid page ref or null when salvage is impossible.
   */
  normalize: (value: Record<string, unknown>) => PageOf<T> | null;
}
