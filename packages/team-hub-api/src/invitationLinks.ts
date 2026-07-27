/**
 * Custom URL scheme registered by HarborClient for deep links from the web.
 */
export const HARBOR_PROTOCOL = 'harborclient';

/**
 * Prefix applied to generated invitation secrets.
 */
export const INVITATION_CODE_PREFIX = 'hbi_';

/**
 * Query parameter names shared by HTTPS join links and harborclient:// join links.
 */
export const TEAM_HUB_JOIN_QUERY_KEYS = {
  url: 'url',
  name: 'name',
  role: 'role',
  exp: 'exp',
  hub: 'hub',
  access: 'access',
  code: 'code'
} as const;

/**
 * Fields used to build and parse Team Hub onboarding invitation links.
 */
export interface InvitationLinkParams {
  /**
   * Team Hub server base URL used for connection and redemption.
   */
  baseUrl: string;

  /**
   * One-time invitation secret prefixed with `hbi_`.
   */
  code: string;

  /**
   * Invited user display name shown in confirmation UI.
   */
  name: string;

  /**
   * Invited user role shown in confirmation UI.
   */
  role: 'admin' | 'user';

  /**
   * ISO-8601 expiry timestamp for the invitation.
   */
  expiresAt: string;

  /**
   * Optional friendly hub label shown in confirmation UI.
   */
  hubName?: string;

  /**
   * Optional human-readable access summary shown in confirmation UI.
   */
  accessSummary?: string;
}

/**
 * Returns whether a string looks like a Team Hub invitation secret.
 *
 * @param value - Candidate invitation code.
 */
export function isInvitationCodeFormat(value: string): boolean {
  return (
    value.startsWith(INVITATION_CODE_PREFIX) && value.length > INVITATION_CODE_PREFIX.length + 8
  );
}

/**
 * Returns whether a string is a valid HTTP or HTTPS Team Hub base URL.
 *
 * @param value - Candidate Team Hub base URL.
 */
export function isTeamHubBaseUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Normalizes a Team Hub base URL by trimming and removing trailing slashes.
 *
 * @param baseUrl - Raw Team Hub base URL.
 */
export function normalizeTeamHubBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

/**
 * Builds the non-secret query string shared by HTTPS and deep links.
 *
 * @param params - Invitation link parameters.
 */
function buildJoinQueryParams(params: InvitationLinkParams): URLSearchParams {
  const query = new URLSearchParams({
    [TEAM_HUB_JOIN_QUERY_KEYS.url]: normalizeTeamHubBaseUrl(params.baseUrl),
    [TEAM_HUB_JOIN_QUERY_KEYS.name]: params.name.trim(),
    [TEAM_HUB_JOIN_QUERY_KEYS.role]: params.role,
    [TEAM_HUB_JOIN_QUERY_KEYS.exp]: params.expiresAt
  });

  if (params.hubName?.trim()) {
    query.set(TEAM_HUB_JOIN_QUERY_KEYS.hub, params.hubName.trim());
  }

  if (params.accessSummary?.trim()) {
    query.set(TEAM_HUB_JOIN_QUERY_KEYS.access, params.accessSummary.trim());
  }

  return query;
}

/**
 * Parses shared invitation link query parameters into {@link InvitationLinkParams}.
 *
 * @param query - Parsed query string from an HTTPS or deep link.
 * @param code - Invitation secret from the fragment or query string.
 */
function parseJoinQueryParams(query: URLSearchParams, code: string): InvitationLinkParams | null {
  const baseUrl = query.get(TEAM_HUB_JOIN_QUERY_KEYS.url)?.trim();
  const name = query.get(TEAM_HUB_JOIN_QUERY_KEYS.name)?.trim();
  const role = query.get(TEAM_HUB_JOIN_QUERY_KEYS.role)?.trim();
  const expiresAt = query.get(TEAM_HUB_JOIN_QUERY_KEYS.exp)?.trim();

  if (!baseUrl || !name || !role || !expiresAt || !isTeamHubBaseUrl(baseUrl)) {
    return null;
  }

  if (role !== 'admin' && role !== 'user') {
    return null;
  }

  if (!isInvitationCodeFormat(code)) {
    return null;
  }

  const hubName = query.get(TEAM_HUB_JOIN_QUERY_KEYS.hub)?.trim();
  const accessSummary = query.get(TEAM_HUB_JOIN_QUERY_KEYS.access)?.trim();

  return {
    baseUrl: normalizeTeamHubBaseUrl(baseUrl),
    code,
    name,
    role,
    expiresAt,
    hubName: hubName || undefined,
    accessSummary: accessSummary || undefined
  };
}

/**
 * Builds an HTTPS join link with display info in the query string and the
 * invitation secret in the URL fragment.
 *
 * @param params - Invitation link parameters.
 * @returns Clickable HTTPS join URL suitable for email and chat delivery.
 */
export function buildTeamHubJoinUrl(params: InvitationLinkParams): string {
  const baseUrl = normalizeTeamHubBaseUrl(params.baseUrl);
  const query = buildJoinQueryParams(params);
  const fragment = new URLSearchParams({
    [TEAM_HUB_JOIN_QUERY_KEYS.code]: params.code.trim()
  });
  return `${baseUrl}/join?${query.toString()}#${fragment.toString()}`;
}

/**
 * Parses an HTTPS Team Hub join link into invitation parameters.
 *
 * @param url - Raw HTTPS join URL from a browser or pasted invite link.
 * @returns Parsed invitation parameters, or null when invalid.
 */
export function parseTeamHubJoinUrl(url: string): InvitationLinkParams | null {
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

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  if (!parsed.pathname.endsWith('/join')) {
    return null;
  }

  const fragmentParams = new URLSearchParams(
    parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash
  );
  const code = fragmentParams.get(TEAM_HUB_JOIN_QUERY_KEYS.code)?.trim();
  if (!code) {
    return null;
  }

  return parseJoinQueryParams(parsed.searchParams, code);
}

/**
 * Builds a harborclient:// join deep link with the invitation secret in the query.
 *
 * @param params - Invitation link parameters.
 * @returns Deep link URL suitable for launching HarborClient.
 */
export function buildTeamHubJoinDeepLink(params: InvitationLinkParams): string {
  const query = buildJoinQueryParams(params);
  query.set(TEAM_HUB_JOIN_QUERY_KEYS.code, params.code.trim());
  return `${HARBOR_PROTOCOL}://team-hub/join?${query.toString()}`;
}

/**
 * Parses a harborclient:// Team Hub join deep link into invitation parameters.
 *
 * @param url - Raw harborclient:// join URL from the OS protocol handler.
 * @returns Parsed invitation parameters, or null when invalid.
 */
export function parseTeamHubJoinDeepLink(url: string): InvitationLinkParams | null {
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

  if (parsed.hostname !== 'team-hub' || parsed.pathname !== '/join') {
    return null;
  }

  const code = parsed.searchParams.get(TEAM_HUB_JOIN_QUERY_KEYS.code)?.trim();
  if (!code) {
    return null;
  }

  return parseJoinQueryParams(parsed.searchParams, code);
}

/**
 * Builds a short human-readable access summary from hub user access lists.
 *
 * @param input - Access list fields from a hub user record.
 * @returns Summary string suitable for invite link query parameters.
 */
export function summarizeInvitationAccess(input: {
  collectionAccess: string[];
  environmentAccess: string[];
  snippetAccess: string[];
  llmAccess: boolean;
  llmModels: string[];
}): string {
  const parts: string[] = [];

  parts.push(`Collections: ${formatAccessList(input.collectionAccess)}`);
  parts.push(`Environments: ${formatAccessList(input.environmentAccess)}`);
  parts.push(`Snippets: ${formatAccessList(input.snippetAccess)}`);

  if (input.llmAccess) {
    parts.push(`LLM: ${formatAccessList(input.llmModels)}`);
  } else {
    parts.push('LLM: disabled');
  }

  return parts.join(' · ');
}

/**
 * Formats one access list for display in invite summaries.
 *
 * @param values - Access list values from a hub user record.
 */
function formatAccessList(values: string[]): string {
  if (values.includes('*')) {
    return 'all';
  }

  if (values.length === 0) {
    return 'none';
  }

  return values.join(', ');
}
