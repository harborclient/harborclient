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
import type { PageRoute } from '#/renderer/src/routing/types';
import {
  defineRoute,
  lazyNamed,
  normalizeSettingsSection
} from '#/renderer/src/store/routingHelpers';
import { resolvePluginTabIcon } from '#/renderer/src/routing/resolvePluginTabIcon';

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
  'settings': defineRoute({
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
  'plugins': defineRoute({
    key: () => 'plugins',
    meta: () => ({ title: 'Plugins', icon: faPuzzlePiece }),
    closeName: () => 'Plugins',
    Component: lazyNamed(
      () => import('#/renderer/src/routing/pages/PluginsPageRoute'),
      'PluginsPageRoute'
    ),
    normalize: () => ({ type: 'plugins' })
  }),
  'themes': defineRoute({
    key: () => 'themes',
    meta: () => ({ title: 'Themes', icon: faPalette }),
    closeName: () => 'Themes',
    Component: lazyNamed(
      () => import('#/renderer/src/routing/pages/ThemesPageRoute'),
      'ThemesPageRoute'
    ),
    normalize: () => ({ type: 'themes' })
  }),
  'snippets': defineRoute({
    key: () => 'snippets',
    meta: () => ({ title: 'Snippets', icon: faCode }),
    closeName: () => 'Snippets',
    Component: lazyNamed(
      () => import('#/renderer/src/routing/pages/SnippetsPageRoute'),
      'SnippetsPageRoute'
    ),
    normalize: () => ({ type: 'snippets' })
  }),
  'cookies': defineRoute({
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
    meta: (_page, ctx) => ({
      title: ctx.pluginTitle ?? 'Plugin',
      icon: resolvePluginTabIcon(ctx.pluginIcon)
    }),
    closeName: (_page, ctx) => ctx.pluginTitle ?? 'Plugin',
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
  'collection': defineRoute({
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
  'folder': defineRoute({
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
  'environment': defineRoute({
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
  }),
  'theme-stylesheet': defineRoute({
    key: () => 'theme-stylesheet',
    meta: (page) => ({ title: page.label, icon: faCode }),
    closeName: () => 'Stylesheet',
    Component: lazyNamed(
      () => import('#/renderer/src/ui/Tabs/Plugins/CustomThemeStylesheetTab'),
      'CustomThemeStylesheetTab'
    ),
    normalize: () => null
  })
} as const satisfies { [T in PageRef['type']]: PageRoute<T> };
