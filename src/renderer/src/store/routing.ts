import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { SettingsSection } from '#/shared/types';
import type { PageRef } from '#/renderer/src/store/tabs';
import { pageRoutes } from '#/renderer/src/routes';
import type {
  PageComponentProps,
  PageMetaContext,
  PageOf,
  PageRoute
} from '#/renderer/src/routing/types';

export type {
  PageComponentProps,
  PageDirtyFlag,
  PageMetaContext,
  PageOf,
  PageRoute
} from '#/renderer/src/routing/types';

/**
 * Built-in settings section identifiers accepted when restoring persisted tabs.
 */
const SETTINGS_SECTIONS = new Set<string>([
  'general',
  'syntax',
  'storage',
  'shortcuts',
  'proxy',
  'globals',
  'ai',
  'backup-restore',
  'git'
]);

/**
 * Returns a typed route definition while preserving the page-type discriminant.
 *
 * @param route - Route entry for a single page type.
 * @returns The same route entry with inferred typing.
 */
export function defineRoute<T extends PageRef['type']>(route: PageRoute<T>): PageRoute<T> {
  return route;
}

/**
 * Lazily loads a page route module and picks a named export as the default component.
 *
 * @param loader - Dynamic import that returns the module namespace.
 * @param exportName - Named export to use as the route component.
 * @returns Lazy component typed like `PageRoute['Component']`.
 */
export function lazyNamed<T extends PageRef['type'], M>(
  loader: () => Promise<M>,
  exportName: keyof M & string
): LazyExoticComponent<ComponentType<PageComponentProps<T>>> {
  return lazy(async () => {
    const mod = await loader();
    return { default: mod[exportName] as ComponentType<PageComponentProps<T>> };
  });
}

/**
 * Normalizes a persisted settings section identifier.
 *
 * @param value - Candidate section from persisted storage.
 * @returns Valid settings section or null when invalid.
 */
export function normalizeSettingsSection(value: unknown): SettingsSection | null {
  if (typeof value !== 'string') {
    return null;
  }
  if (SETTINGS_SECTIONS.has(value)) {
    return value as SettingsSection;
  }
  if (value.startsWith('plugin:')) {
    return value as SettingsSection;
  }
  return null;
}

/**
 * Looks up the route entry for a page type.
 *
 * @param type - Page discriminant.
 * @returns Route definition for that page type.
 */
export function getPageRoute<T extends PageRef['type']>(type: T): PageRoute<T> {
  return pageRoutes[type] as unknown as PageRoute<T>;
}

/**
 * Returns the stable dedupe key for a page reference via the route registry.
 *
 * @param page - Page identity to key.
 * @returns Stable string used to find an existing page tab.
 */
export function routePageRefKey(page: PageRef): string {
  const route = getPageRoute(page.type);
  return route.key(page as PageOf<typeof page.type>);
}

/**
 * Returns tab title and icon metadata via the route registry.
 *
 * @param page - Page reference stored on the tab.
 * @param ctx - Optional resolved names for entity-specific pages.
 * @returns Title and icon for the tab bar.
 */
export function routePageMeta(
  page: PageRef,
  ctx: PageMetaContext = {}
): { title: string; icon: import('@fortawesome/fontawesome-svg-core').IconDefinition } {
  const route = getPageRoute(page.type);
  return route.meta(page as PageOf<typeof page.type>, ctx);
}

/**
 * Returns the close-prompt display name for a page via the route registry.
 *
 * @param page - Page reference for the tab being closed.
 * @param ctx - Optional resolved entity names.
 * @returns Display name for the confirmation dialog.
 */
export function routePageCloseName(page: PageRef, ctx: PageMetaContext = {}): string {
  const route = getPageRoute(page.type);
  if (route.closeName) {
    return route.closeName(page as PageOf<typeof page.type>, ctx);
  }
  return route.meta(page as PageOf<typeof page.type>, ctx).title;
}

/**
 * Salvages a persisted page reference using the route registry.
 * Handles cross-type legacy aliases before dispatching to a typed normalize.
 *
 * @param value - Candidate page object from persisted storage.
 * @returns Valid PageRef or null when salvage is impossible.
 */
export function normalizePersistedPageRef(value: unknown): PageRef | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.type !== 'string') {
    return null;
  }

  // Legacy: settings tabs that pointed at the snippets section become snippets tabs.
  if (record.type === 'settings' && record.section === 'snippets') {
    return { type: 'snippets' };
  }

  // Legacy: plugin-view was renamed to hosted-main-view.
  if (record.type === 'plugin-view') {
    return pageRoutes['hosted-main-view'].normalize(record);
  }

  if (!(record.type in pageRoutes)) {
    return null;
  }

  const type = record.type as PageRef['type'];
  return pageRoutes[type].normalize(record) as PageRef | null;
}
