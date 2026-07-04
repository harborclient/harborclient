/**
 * Custom URL scheme registered by HarborClient for deep links from the web.
 */
export const HARBOR_PROTOCOL = 'harborclient';

const PLUGIN_MANIFEST_ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9.-]*\.[a-zA-Z][a-zA-Z0-9.-]+$/;

/**
 * Parsed HarborClient deep-link action dispatched to the renderer.
 */
export type HarborDeepLink =
  | {
      action: 'install-plugin';
      pluginId: string;
    }
  | {
      action: 'install-theme';
      pluginId: string;
    };

/**
 * Returns whether a string is a valid plugin manifest id.
 *
 * @param value - Candidate plugin id from a deep-link query parameter.
 */
function isPluginManifestId(value: string): boolean {
  return value.length >= 3 && PLUGIN_MANIFEST_ID_PATTERN.test(value);
}

/**
 * Parses an install deep link for plugins or themes when the host and path match.
 *
 * @param parsed - Parsed harborclient:// URL.
 * @param hostname - Expected URL hostname (`plugin` or `theme`).
 * @param action - Deep-link action to return when valid.
 * @returns Parsed install action, or null when invalid.
 */
function parseInstallDeepLink(
  parsed: URL,
  hostname: 'plugin' | 'theme',
  action: HarborDeepLink['action']
): HarborDeepLink | null {
  if (parsed.hostname !== hostname || parsed.pathname !== '/install') {
    return null;
  }

  const pluginId = parsed.searchParams.get('id')?.trim();
  if (!pluginId || !isPluginManifestId(pluginId)) {
    return null;
  }

  return { action, pluginId } as HarborDeepLink;
}

/**
 * Parses a harborclient:// URL into a supported deep-link action.
 *
 * Only plugin ids from the query string are trusted; repository URLs must be
 * resolved from the curated marketplace catalog inside the app.
 *
 * @param url - Raw URL from the OS protocol handler or launch argv.
 * @returns Parsed action, or null when the URL is unsupported or invalid.
 */
export function parseHarborDeepLink(url: string): HarborDeepLink | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== `${HARBOR_PROTOCOL}:`) {
    return null;
  }

  return (
    parseInstallDeepLink(parsed, 'plugin', 'install-plugin') ??
    parseInstallDeepLink(parsed, 'theme', 'install-theme')
  );
}

/**
 * Builds a harborclient:// install URL for one marketplace plugin id.
 *
 * @param pluginId - Catalog plugin manifest id.
 * @returns Deep-link URL suitable for docs and external links.
 */
export function buildPluginInstallDeepLink(pluginId: string): string {
  return `${HARBOR_PROTOCOL}://plugin/install?id=${encodeURIComponent(pluginId)}`;
}

/**
 * Builds a harborclient:// install URL for one marketplace theme id.
 *
 * @param pluginId - Catalog theme manifest id.
 * @returns Deep-link URL suitable for docs and external links.
 */
export function buildThemeInstallDeepLink(pluginId: string): string {
  return `${HARBOR_PROTOCOL}://theme/install?id=${encodeURIComponent(pluginId)}`;
}
