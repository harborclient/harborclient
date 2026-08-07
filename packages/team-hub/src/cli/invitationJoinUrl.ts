/**
 * Fields required to build a pasteable Team Hub HTTPS invitation join URL.
 */
export interface InviteJoinUrlParams {
  /**
   * Client-reachable Team Hub base URL (no trailing slash).
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
}

/**
 * Normalizes a Team Hub base URL by trimming and removing trailing slashes.
 *
 * @param baseUrl - Raw Team Hub base URL.
 * @returns Trimmed base URL without a trailing slash.
 */
export function normalizeInviteBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

/**
 * Parses and validates a Team Hub base URL from CLI `--base-url` input.
 *
 * @param value - Candidate HTTP(S) base URL from a Commander option.
 * @returns Normalized base URL without a trailing slash.
 * @throws {Error} When the value is not a valid http: or https: URL.
 */
export function parseInviteBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Base URL must not be empty.');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Base URL must be a valid http:// or https:// URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Base URL must be a valid http:// or https:// URL.');
  }

  return normalizeInviteBaseUrl(trimmed);
}

/**
 * Derives a client-reachable Team Hub base URL from listen settings or an override.
 *
 * Wildcard bind addresses (`0.0.0.0`, `::`) are shown as `127.0.0.1` so local
 * invite links open correctly. Prefer {@link override} when the public hub URL
 * differs from the process bind address (for example behind Docker or Nginx).
 *
 * @param host - Configured `server.host` bind address.
 * @param port - Configured `server.port`.
 * @param override - Optional explicit base URL from `--base-url`.
 * @returns Normalized `http://` or `https://` base URL without a trailing slash.
 */
export function resolveInviteBaseUrl(host: string, port: number, override?: string): string {
  if (override !== undefined) {
    return parseInviteBaseUrl(override);
  }

  const displayHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
  const formattedHost =
    displayHost.includes(':') && !displayHost.startsWith('[') ? `[${displayHost}]` : displayHost;
  return `http://${formattedHost}:${port}`;
}

/**
 * Builds an HTTPS (or HTTP) join URL with display fields in the query and the
 * invitation secret in the URL fragment.
 *
 * Matches the Accept Team Hub Invite paste format used by HarborClient.
 *
 * @param params - Invitation link parameters.
 * @returns Clickable join URL suitable for sharing and pasting into HarborClient.
 */
export function buildInviteJoinUrl(params: InviteJoinUrlParams): string {
  const baseUrl = normalizeInviteBaseUrl(params.baseUrl);
  const query = new URLSearchParams({
    url: baseUrl,
    name: params.name.trim(),
    role: params.role,
    exp: params.expiresAt
  });
  const fragment = new URLSearchParams({
    code: params.code.trim()
  });
  return `${baseUrl}/join?${query.toString()}#${fragment.toString()}`;
}
