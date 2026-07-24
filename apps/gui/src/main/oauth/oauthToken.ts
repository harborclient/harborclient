import { encodeBasicAuth } from '#/shared/auth';
import type { OAuth2Config, OAuthFetchTokenResult } from '#/shared/auth';
import { deleteOAuthToken, getOAuthToken, storeOAuthToken } from './oauthSecrets';

const TOKEN_EXPIRY_BUFFER_MS = 60_000;

/**
 * Parses a token endpoint JSON response into an OAuthFetchTokenResult.
 *
 * @param payload - Parsed JSON body from the token endpoint.
 * @returns Normalized token result.
 * @throws When access_token is missing or not a string.
 */
function parseTokenResponse(payload: unknown): OAuthFetchTokenResult {
  if (payload == null || typeof payload !== 'object') {
    throw new Error('OAuth token response was not a JSON object.');
  }

  const record = payload as Record<string, unknown>;
  const accessToken = record.access_token;
  if (typeof accessToken !== 'string' || !accessToken.trim()) {
    throw new Error('OAuth token response did not include access_token.');
  }

  const tokenType = typeof record.token_type === 'string' ? record.token_type : 'Bearer';
  let expiresAt: string | undefined;
  if (typeof record.expires_in === 'number' && Number.isFinite(record.expires_in)) {
    expiresAt = new Date(Date.now() + record.expires_in * 1000).toISOString();
  }

  return {
    accessToken,
    expiresAt,
    tokenType
  };
}

/**
 * Returns whether a cached token is still valid with a safety buffer.
 *
 * @param expiresAt - ISO expiry timestamp from cache, if any.
 */
function isCachedTokenValid(expiresAt?: string): boolean {
  if (!expiresAt) {
    return true;
  }

  const expiryMs = Date.parse(expiresAt);
  if (Number.isNaN(expiryMs)) {
    return false;
  }

  return expiryMs - TOKEN_EXPIRY_BUFFER_MS > Date.now();
}

/**
 * Validates OAuth Client Credentials configuration before a network request.
 *
 * @param config - Resolved OAuth 2.0 configuration.
 * @throws When required fields are missing.
 */
function assertOAuthConfig(config: OAuth2Config): void {
  if (!config.tokenUrl.trim()) {
    throw new Error('OAuth token URL is required.');
  }
  if (!config.clientId.trim()) {
    throw new Error('OAuth client id is required.');
  }
  if (!config.clientSecret.trim()) {
    throw new Error('OAuth client secret is required.');
  }
}

/**
 * Fetches an OAuth 2.0 access token using the Client Credentials grant.
 *
 * @param config - Resolved OAuth 2.0 configuration.
 * @returns Token payload from the authorization server.
 */
export async function fetchClientCredentialsToken(
  config: OAuth2Config
): Promise<OAuthFetchTokenResult> {
  assertOAuthConfig(config);

  const body = new URLSearchParams();
  body.set('grant_type', 'client_credentials');
  if (config.scope.trim()) {
    body.set('scope', config.scope.trim());
  }
  if (config.audience.trim()) {
    body.set('audience', config.audience.trim());
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded'
  };

  if (config.clientAuth === 'header') {
    headers.Authorization = `Basic ${encodeBasicAuth(config.clientId.trim(), config.clientSecret)}`;
  } else {
    body.set('client_id', config.clientId.trim());
    body.set('client_secret', config.clientSecret);
  }

  const response = await fetch(config.tokenUrl.trim(), {
    method: 'POST',
    headers,
    body: body.toString()
  });

  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      response.ok
        ? 'OAuth token response was not valid JSON.'
        : `OAuth token request failed (${response.status}): ${text || response.statusText}`
    );
  }

  if (!response.ok) {
    const record = payload != null && typeof payload === 'object' ? payload : {};
    const errorDescription =
      typeof (record as Record<string, unknown>).error_description === 'string'
        ? (record as Record<string, unknown>).error_description
        : typeof (record as Record<string, unknown>).error === 'string'
          ? (record as Record<string, unknown>).error
          : text || response.statusText;
    throw new Error(`OAuth token request failed (${response.status}): ${errorDescription}`);
  }

  return parseTokenResponse(payload);
}

/**
 * Returns a valid OAuth access token, using cache when available unless forced.
 *
 * @param cacheKey - Stable cache key; empty string skips persistence.
 * @param config - Resolved OAuth 2.0 configuration.
 * @param force - When true, always fetch a fresh token and refresh the cache.
 * @returns Token payload suitable for Authorization header construction.
 */
export async function getValidOAuthToken(
  cacheKey: string,
  config: OAuth2Config,
  force: boolean
): Promise<OAuthFetchTokenResult> {
  if (!force && cacheKey) {
    const cached = getOAuthToken(cacheKey);
    if (cached && isCachedTokenValid(cached.expiresAt)) {
      return {
        accessToken: cached.accessToken,
        expiresAt: cached.expiresAt,
        tokenType: cached.tokenType
      };
    }
  }

  const fetched = await fetchClientCredentialsToken(config);
  if (cacheKey) {
    storeOAuthToken(cacheKey, fetched.accessToken, fetched.tokenType, fetched.expiresAt);
  }
  return fetched;
}

/**
 * Clears a cached OAuth token for the given cache key.
 *
 * @param cacheKey - Stable cache key to remove from storage.
 */
export function clearOAuthToken(cacheKey: string): void {
  if (!cacheKey) {
    return;
  }
  deleteOAuthToken(cacheKey);
}
