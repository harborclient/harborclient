import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
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
function defineRoute<T extends PageRef['type']>(route: PageRoute<T>): PageRoute<T> {
  return route;
}

/**
 * Lazily loads a page route module and picks a named export as the default component.
 *
 * @param loader - Dynamic import that returns the module namespace.
 * @param exportName - Named export to use as the route component.
 * @returns Lazy component compatible with {@link PageRoute.Component}.
 */
function lazyNamed<T extends PageRef['type'], M>(
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
function normalizeSettingsSection(value: unknown): SettingsSection | null {
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
 * Declarative registry of every configuration page tab.
 * Identity, chrome, render, dirty/close behavior, and persistence live here.
 */
export const pageRoutes = {
  'getting-started': defineRoute({
    key: () => 'getting-started',
    meta: () => ({ title: 'Getting Started', icon: faBook }),
    closeName: () => 'Getting Started',
    Component: lazyNamed(
      () => import('#/renderer/src/routing/pages/GettingStartedPageRoute'),
      'GettingStartedPageRoute'
    ),
    normalize: () => ({ type: 'getting-started' })
  }),
  settings: defineRoute({
    key: () => 'settings',
    meta: (page) => {
      if (page.section.startsWith('plugin:')) {
        return { title: 'Settings', icon: faGear };
      }
      try {
        const sectionMeta = settingsSectionMeta(page.section as SettingsSection);
        return { title: sectionMeta.label, icon: sectionMeta.icon };
      } catch {
        return { title: 'Settings', icon: faGear };
      }
    },
    closeName: () => 'Settings',
    replaceOnReopen: true,
    Component: lazyNamed(
      () => import('#/renderer/src/routing/pages/SettingsPageRoute'),
      'SettingsPageRoute'
    ),
    normalize: (value) => {
      const section = normalizeSettingsSection(value.section ?? 'general');
      return section ? { type: 'settings', section } : null;
    }
  }),
  plugins: defineRoute({
    key: () => 'plugins',
    meta: () => ({ title: 'Plugins', icon: faPuzzlePiece }),
    closeName: () => 'Plugins',
    Component: lazyNamed(
      () => import('#/renderer/src/routing/pages/PluginsPageRoute'),
      'PluginsPageRoute'
    ),
    normalize: () => ({ type: 'plugins' })
  }),
  themes: defineRoute({
    key: () => 'themes',
    meta: () => ({ title: 'Themes', icon: faPalette }),
    closeName: () => 'Themes',
    Component: lazyNamed(
      () => import('#/renderer/src/routing/pages/ThemesPageRoute'),
      'ThemesPageRoute'
    ),
    normalize: () => ({ type: 'themes' })
  }),
  snippets: defineRoute({
    key: () => 'snippets',
    meta: () => ({ title: 'Snippets', icon: faCode }),
    closeName: () => 'Snippets',
    Component: lazyNamed(
      () => import('#/renderer/src/routing/pages/SnippetsPageRoute'),
      'SnippetsPageRoute'
    ),
    normalize: () => ({ type: 'snippets' })
  }),
  cookies: defineRoute({
    key: () => 'cookies',
    meta: () => ({ title: 'Cookies', icon: faCookieBite }),
    closeName: () => 'Cookies',
    Component: lazyNamed(
      () => import('#/renderer/src/routing/pages/CookiesPageRoute'),
      'CookiesPageRoute'
    ),
    normalize: () => ({ type: 'cookies' })
  }),
  'team-hubs': defineRoute({
    key: () => 'team-hubs',
    meta: () => ({ title: 'Team Hub', icon: faUsers }),
    closeName: () => 'Team Hub',
    Component: lazyNamed(
      () => import('#/renderer/src/routing/pages/TeamHubsPageRoute'),
      'TeamHubsPageRoute'
    ),
    normalize: () => ({ type: 'team-hubs' })
  }),
  'team-hub-admin': defineRoute({
    key: (page) => `team-hub-admin:${page.hubId}`,
    meta: (_page, ctx) => ({ title: ctx.teamHubName ?? 'Untitled', icon: faUsers }),
    closeName: (_page, ctx) => ctx.teamHubName ?? 'Untitled',
    Component: lazyNamed(
      () => import('#/renderer/src/routing/pages/TeamHubAdminPageRoute'),
      'TeamHubAdminPageRoute'
    ),
    normalize: (value) => {
      if (typeof value.hubId !== 'string' || value.hubId.length === 0) {
        return null;
      }
      return {
        type: 'team-hub-admin',
        hubId: value.hubId,
        ...(typeof value.label === 'string' && value.label.trim().length > 0
          ? { label: value.label.trim() }
          : {})
      };
    }
  }),
  'sharing-keys': defineRoute({
    key: () => 'sharing-keys',
    meta: () => ({ title: 'Sharing Keys', icon: faFingerprint }),
    closeName: () => 'Sharing Keys',
    Component: lazyNamed(
      () => import('#/renderer/src/routing/pages/SharingKeysPageRoute'),
      'SharingKeysPageRoute'
    ),
    normalize: () => ({ type: 'sharing-keys' })
  }),
  'hosted-main-view': defineRoute({
    key: (page) => `hosted-main-view:${page.pluginId}:${page.viewId}`,
    meta: (_page, ctx) => ({ title: ctx.pluginTitle ?? 'Plugin', icon: faPuzzlePiece }),
    closeName: () => 'Plugin',
    Component: lazyNamed(
      () => import('#/renderer/src/routing/pages/HostedMainViewPageRoute'),
      'HostedMainViewPageRoute'
    ),
    normalize: (value) => {
      if (typeof value.pluginId !== 'string' || typeof value.viewId !== 'string') {
        return null;
      }
      return { type: 'hosted-main-view', pluginId: value.pluginId, viewId: value.viewId };
    }
  }),
  collection: defineRoute({
    key: (page) => `collection:${page.id}`,
    meta: (_page, ctx) => ({ title: ctx.collectionName ?? 'Collection', icon: faDatabase }),
    closeName: (_page, ctx) => ctx.collectionName ?? 'Collection',
    dirtyFlag: 'collection',
    replaceOnReopen: true,
    Component: lazyNamed(
      () => import('#/renderer/src/routing/pages/CollectionPageRoute'),
      'CollectionPageRoute'
    ),
    normalize: (value) => {
      if (typeof value.id !== 'number' || !Number.isFinite(value.id)) {
        return null;
      }
      return { type: 'collection', id: value.id };
    }
  }),
  folder: defineRoute({
    key: (page) => `folder:${page.id}`,
    meta: (_page, ctx) => ({ title: ctx.folderName ?? 'Folder', icon: faFolder }),
    closeName: () => 'Folder',
    dirtyFlag: 'folder',
    replaceOnReopen: true,
    Component: lazyNamed(
      () => import('#/renderer/src/routing/pages/FolderPageRoute'),
      'FolderPageRoute'
    ),
    /**
     * Folder page tabs are not restored from persistence today.
     *
     * @returns Always null.
     */
    normalize: () => null
  }),
  environment: defineRoute({
    key: (page) => `environment:${page.id}`,
    meta: (_page, ctx) => ({ title: ctx.environmentName ?? 'Environment', icon: faGlobe }),
    closeName: (_page, ctx) => ctx.environmentName ?? 'Environment',
    dirtyFlag: 'environment',
    replaceOnReopen: true,
    Component: lazyNamed(
      () => import('#/renderer/src/routing/pages/EnvironmentPageRoute'),
      'EnvironmentPageRoute'
    ),
    normalize: (value) => {
      if (typeof value.id !== 'number' || !Number.isFinite(value.id)) {
        return null;
      }
      return { type: 'environment', id: value.id };
    }
  }),
  'collection-runner': defineRoute({
    key: () => 'collection-runner',
    meta: (_page, ctx) => ({
      title: ctx.runnerTargetName ? `Run ${ctx.runnerTargetName}` : 'Runner',
      icon: faPlay
    }),
    closeName: () => 'Collection Runner',
    replaceOnReopen: true,
    Component: lazyNamed(
      () => import('#/renderer/src/routing/pages/CollectionRunnerPageRoute'),
      'CollectionRunnerPageRoute'
    ),
    normalize: (value) => {
      if (typeof value.collectionId !== 'number' || !Number.isFinite(value.collectionId)) {
        return null;
      }
      const folderId =
        value.folderId == null
          ? null
          : typeof value.folderId === 'number' && Number.isFinite(value.folderId)
            ? value.folderId
            : null;
      const requestId =
        value.requestId == null
          ? null
          : typeof value.requestId === 'number' && Number.isFinite(value.requestId)
            ? value.requestId
            : null;
      const requestIds = Array.isArray(value.requestIds)
        ? value.requestIds.filter(
            (entry): entry is number => typeof entry === 'number' && Number.isFinite(entry)
          )
        : undefined;
      return {
        type: 'collection-runner',
        collectionId: value.collectionId,
        folderId,
        requestId,
        ...(requestIds != null && requestIds.length > 0 ? { requestIds } : {})
      };
    }
  }),
  'plugin-detail': defineRoute({
    key: (page) => `plugin-detail:${page.kind}:${page.source}:${page.id}`,
    meta: (page) => ({
      title: page.label,
      icon: page.kind === 'themes' ? faPalette : faPuzzlePiece
    }),
    closeName: (page) => page.label,
    Component: lazyNamed(
      () => import('#/renderer/src/ui/Tabs/Plugins/PluginDetailPage'),
      'PluginDetailPage'
    ),
    normalize: () => null
  }),
  'snippet-detail': defineRoute({
    key: (page) => `snippet-detail:${page.catalogId}`,
    meta: (page) => ({ title: page.label, icon: faCode }),
    closeName: (page) => page.label,
    Component: lazyNamed(
      () => import('#/renderer/src/ui/Tabs/Snippets/SnippetDetailPage'),
      'SnippetDetailPage'
    ),
    normalize: () => null
  }),
  'snippet-edit': defineRoute({
    key: (page) => `snippet-edit:${page.snippetId ?? page.mode}`,
    meta: (page) => ({ title: page.label, icon: faCode }),
    closeName: (page) => page.label,
    Component: lazyNamed(
      () => import('#/renderer/src/ui/Tabs/Snippets/SnippetEditPage'),
      'SnippetEditPage'
    ),
    normalize: () => null
  }),
  'script-editor': defineRoute({
    key: (page) => `script-editor:${page.requestTabId}:${page.phase}:${page.scriptId}`,
    meta: (page) => ({ title: page.label, icon: faCode }),
    closeName: (page) => page.label,
    Component: lazyNamed(
      () => import('#/renderer/src/ui/Main/RequestEditor/ScriptEditorTab'),
      'ScriptEditorTab'
    ),
    normalize: () => null
  }),
  'merge-editor': defineRoute({
    key: (page) => `merge-editor:${page.connectionId}:${page.filePath}`,
    meta: (page) => ({ title: page.label, icon: faCodeBranch }),
    closeName: () => 'Tab',
    Component: lazyNamed(
      () => import('#/renderer/src/ui/Main/RequestEditor/MergeEditorTab'),
      'MergeEditorTab'
    ),
    normalize: () => null
  })
} as const satisfies { [T in PageRef['type']]: PageRoute<T> };

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
