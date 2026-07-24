import {
  buildTeamHubJoinDeepLink as buildApiTeamHubJoinDeepLink,
  buildTeamHubJoinUrl as buildApiTeamHubJoinUrl,
  isInvitationCodeFormat,
  isTeamHubBaseUrl,
  normalizeTeamHubBaseUrl,
  parseTeamHubJoinDeepLink as parseApiTeamHubJoinDeepLink,
  parseTeamHubJoinUrl,
  summarizeInvitationAccess,
  type InvitationLinkParams
} from '@harborclient/team-hub-api';

/**
 * Custom URL scheme registered by HarborClient for deep links from the web.
 */
export const HARBOR_PROTOCOL = 'harborclient';

export {
  buildApiTeamHubJoinUrl as buildTeamHubJoinUrl,
  summarizeInvitationAccess,
  type InvitationLinkParams
};

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
    }
  | {
      action: 'install-snippet';
      pluginId: string;
    }
  | {
      action: 'open-run-results';
      uuid: string;
    }
  | TeamHubJoinDeepLinkPayload;

/**
 * Parsed Team Hub join payload carried by HTTPS invite links and deep links.
 */
export interface TeamHubJoinDeepLinkPayload {
  action: 'join-team-hub';
  baseUrl: string;
  code: string;
  name?: string;
  role?: 'admin' | 'user';
  expiresAt?: string;
  hubName?: string;
  accessSummary?: string;
}

const RUN_RESULT_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
 * @param hostname - Expected URL hostname (`plugin`, `theme`, or `snippet`).
 * @param action - Deep-link action to return when valid.
 * @returns Parsed install action, or null when invalid.
 */
function parseInstallDeepLink(
  parsed: URL,
  hostname: 'plugin' | 'theme' | 'snippet',
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
 * Parses a harborclient://run/<uuid> deep link when the host and path match.
 *
 * @param parsed - Parsed harborclient:// URL.
 * @returns Parsed open-run-results action, or null when invalid.
 */
function parseRunResultsDeepLink(parsed: URL): HarborDeepLink | null {
  if (parsed.hostname !== 'run') {
    return null;
  }

  const uuid = parsed.pathname.replace(/^\/+/, '').trim();
  if (!uuid || !RUN_RESULT_UUID_PATTERN.test(uuid)) {
    return null;
  }

  return { action: 'open-run-results', uuid };
}

/**
 * Maps shared invitation link parameters into a renderer join payload.
 *
 * @param params - Parsed invitation link parameters.
 */
function mapInvitationLinkParams(params: InvitationLinkParams): TeamHubJoinDeepLinkPayload {
  return {
    action: 'join-team-hub',
    baseUrl: params.baseUrl,
    code: params.code,
    name: params.name,
    role: params.role,
    expiresAt: params.expiresAt,
    hubName: params.hubName,
    accessSummary: params.accessSummary
  };
}

/**
 * Parses a legacy harborclient:// join deep link that only includes url and code.
 *
 * @param parsed - Parsed harborclient:// URL.
 */
function parseLegacyTeamHubJoinDeepLink(parsed: URL): TeamHubJoinDeepLinkPayload | null {
  if (parsed.hostname !== 'team-hub' || parsed.pathname !== '/join') {
    return null;
  }

  const baseUrl = parsed.searchParams.get('url')?.trim();
  const code = parsed.searchParams.get('code')?.trim();
  if (!baseUrl || !code || !isTeamHubBaseUrl(baseUrl) || !isInvitationCodeFormat(code)) {
    return null;
  }

  return {
    action: 'join-team-hub',
    baseUrl: normalizeTeamHubBaseUrl(baseUrl),
    code
  };
}

/**
 * Parses a harborclient://team-hub/join deep link when the host and path match.
 *
 * @param parsed - Parsed harborclient:// URL.
 * @returns Parsed join-team-hub action, or null when invalid.
 */
function parseTeamHubJoinDeepLink(parsed: URL): TeamHubJoinDeepLinkPayload | null {
  const full = parseApiTeamHubJoinDeepLink(parsed.toString());
  if (full) {
    return mapInvitationLinkParams(full);
  }

  return parseLegacyTeamHubJoinDeepLink(parsed);
}

/**
 * Parses an HTTPS or harborclient:// Team Hub invite link into a join payload.
 *
 * @param url - Raw invite link pasted by the user or opened from a browser.
 * @returns Parsed join payload, or null when invalid.
 */
export function parseTeamHubInviteLink(url: string): TeamHubJoinDeepLinkPayload | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  const httpsParams = parseTeamHubJoinUrl(trimmed);
  if (httpsParams) {
    return mapInvitationLinkParams(httpsParams);
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

  return parseTeamHubJoinDeepLink(parsed);
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
    parseInstallDeepLink(parsed, 'theme', 'install-theme') ??
    parseInstallDeepLink(parsed, 'snippet', 'install-snippet') ??
    parseRunResultsDeepLink(parsed) ??
    parseTeamHubJoinDeepLink(parsed)
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

/**
 * Builds a harborclient:// install URL for one marketplace snippet bundle id.
 *
 * @param pluginId - Catalog snippet bundle manifest id.
 * @returns Deep-link URL suitable for docs and external links.
 */
export function buildSnippetInstallDeepLink(pluginId: string): string {
  return `${HARBOR_PROTOCOL}://snippet/install?id=${encodeURIComponent(pluginId)}`;
}

/**
 * Builds a harborclient:// run-results URL for one saved snapshot UUID.
 *
 * @param uuid - Stable run result UUID from storage or a Team Hub share link.
 * @returns Deep-link URL suitable for clipboard copy and external links.
 */
export function buildRunResultsDeepLink(uuid: string): string {
  return `${HARBOR_PROTOCOL}://run/${encodeURIComponent(uuid)}`;
}

/**
 * Builds a harborclient:// join URL for one Team Hub onboarding invitation.
 *
 * @param params - Invitation link parameters including display metadata.
 * @returns Deep-link URL suitable for launching HarborClient.
 */
export function buildTeamHubJoinDeepLink(params: InvitationLinkParams): string {
  return buildApiTeamHubJoinDeepLink(params);
}

/**
 * Returns true when a join payload includes enough display metadata to skip preview.
 *
 * @param payload - Parsed join payload from an invite link.
 */
export function hasTeamHubJoinDisplayMetadata(payload: {
  name?: string;
  role?: 'admin' | 'user';
  expiresAt?: string;
}): boolean {
  return Boolean(payload.name && payload.role && payload.expiresAt);
}
