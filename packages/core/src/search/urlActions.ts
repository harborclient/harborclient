import type { ActionCommandDefinition } from './actions';

/**
 * Stable action ids for URL-paste suggestions in the Action menu.
 */
export const URL_ACTION_IDS = {
  imageOpen: 'url:image-open',
  importOpen: 'url:import-open',
  livePageOpen: 'url:live-page-open'
} as const;

/**
 * Image file extensions that open in the Image viewer tab.
 */
const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'ico',
  'svg',
  'avif'
]);

/**
 * Importable document extensions routed through the File → Import pipeline.
 */
const IMPORT_EXTENSIONS = new Set(['json']);

/**
 * Executable / script extensions that must not be opened from the Action menu.
 */
const DENIED_EXTENSIONS = new Set([
  'js',
  'mjs',
  'cjs',
  'exe',
  'com',
  'bat',
  'cmd',
  'sh',
  'bash',
  'zsh',
  'fish',
  'ps1',
  'psm1',
  'vbs',
  'vbe',
  'wsf',
  'wsh',
  'scr',
  'msi',
  'msp',
  'dll',
  'so',
  'dylib',
  'jar',
  'apk',
  'deb',
  'rpm',
  'bin',
  'run',
  'app',
  'dmg',
  'pkg',
  'command'
]);

/**
 * Result of classifying a pasted Action menu URL.
 */
export interface ActionMenuUrlMatch {
  /**
   * Absolute http(s) URL normalized by the URL parser.
   */
  url: string;

  /**
   * Context actions to show for this URL (empty when denied).
   */
  actions: ActionCommandDefinition[];

  /**
   * True when the URL path ends with a blocked executable / script extension.
   */
  denied: boolean;
}

/**
 * Returns whether the query looks like an absolute http(s) URL paste.
 *
 * @param query - Raw Action menu input.
 */
export function isActionMenuUrlQuery(query: string): boolean {
  const trimmed = query.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Extracts the lowercase file extension from a URL pathname (no leading dot).
 *
 * @param url - Absolute URL.
 * @returns Extension without the dot, or null when the path has none.
 */
export function urlPathExtension(url: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }

  const base = pathname.split('/').filter(Boolean).pop();
  if (base == null || !base.includes('.')) {
    return null;
  }

  const ext = base.slice(base.lastIndexOf('.') + 1).toLowerCase();
  return ext.length > 0 ? ext : null;
}

/**
 * Builds the Action menu suggestions for a pasted http(s) URL.
 *
 * Image and Import actions appear first when the path matches; Live Page is
 * always offered last for allowed URLs. Executable extensions return an empty
 * action list with `denied: true`.
 *
 * @param query - Raw Action menu input.
 * @returns Match details when the query is an http(s) URL, otherwise null.
 */
export function matchUrlActionSuggestions(query: string): ActionMenuUrlMatch | null {
  if (!isActionMenuUrlQuery(query)) {
    return null;
  }

  const url = new URL(query.trim()).toString();
  const extension = urlPathExtension(url);

  if (extension != null && DENIED_EXTENSIONS.has(extension)) {
    return { url, actions: [], denied: true };
  }

  const actions: ActionCommandDefinition[] = [];

  if (extension != null && IMAGE_EXTENSIONS.has(extension)) {
    actions.push({
      id: URL_ACTION_IDS.imageOpen,
      group: 'Image',
      label: 'Open',
      description: 'Open this image in a viewer tab'
    });
  }

  if (extension != null && IMPORT_EXTENSIONS.has(extension)) {
    actions.push({
      id: URL_ACTION_IDS.importOpen,
      group: 'Import',
      label: 'Open',
      description: 'Import this file through File → Import'
    });
  }

  actions.push({
    id: URL_ACTION_IDS.livePageOpen,
    group: 'Live Page',
    label: 'Open',
    description: 'Open this URL in a Live Page tab'
  });

  return { url, actions, denied: false };
}
