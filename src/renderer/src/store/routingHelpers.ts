import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { SettingsSection } from '#/shared/types';
import type { PageRef } from '#/renderer/src/store/tabs';
import type { PageComponentProps, PageRoute } from '#/renderer/src/routing/types';

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
