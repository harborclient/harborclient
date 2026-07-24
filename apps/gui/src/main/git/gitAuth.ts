import {
  completeGitHubDeviceFlow,
  GITHUB_OAUTH_CLIENT_ID,
  refreshGitHubAccessToken,
  startGitHubDeviceFlow
} from './githubOAuth';
import {
  deleteGitIdentity,
  getGitIdentity,
  listGitIdentities,
  persistGitIdentityAuth,
  persistGitIdentityLogin,
  setGitIdentityOAuthClientId,
  upsertGitIdentity
} from './gitIdentities';
import {
  deleteGitSecrets,
  getGitAccessToken,
  getGitRefreshToken,
  getGitTokenExpiresAt,
  hasGitAccessToken,
  storeGitOAuthTokens,
  storeGitPat
} from './gitSecrets';
import type { StorageConnection, GitAuthMethod, GitIdentity } from '#/shared/types';
import { isGitHubRepositoryUrl, normalizeGitHostKey } from '#/shared/gitUrl';
import { listStorageConnections } from '#/main/settings/storageSettings';
import { validateRemoteCredentials, type GitRemoteValidationResult } from './gitRemoteValidation';

/**
 * Resolved HTTPS credentials for isomorphic-git onAuth.
 */
export interface ResolvedGitAuth {
  /**
   * Basic Auth username.
   */
  username: string;

  /**
   * Basic Auth password (PAT or OAuth access token).
   */
  password: string;
}

/**
 * Returns the git connection configuration for a connection id.
 *
 * @param connectionId - Git connection id.
 */
function requireGitConnection(connectionId: string): StorageConnection & { type: 'git' } {
  const conn = listStorageConnections().find((item) => item.id === connectionId);
  if (!conn || conn.type !== 'git') {
    throw new Error(`Git connection not found: ${connectionId}`);
  }
  return conn;
}

/**
 * Normalizes and requires a git host key from a URL or hostname.
 *
 * @param urlOrHost - HTTPS git URL or bare hostname.
 */
export function requireGitHost(urlOrHost: string): string {
  const host = normalizeGitHostKey(urlOrHost);
  if (!host) {
    throw new Error('Enter a valid HTTPS repository URL before configuring git authentication.');
  }
  return host;
}

/**
 * Resolves the host key for a git connection.
 *
 * @param connectionId - Git connection id.
 */
export function resolveConnectionHost(connectionId: string): string {
  const conn = requireGitConnection(connectionId);
  return requireGitHost(conn.settings.url);
}

/**
 * Returns the identity for a host, creating a default PAT-shaped record when missing.
 *
 * @param host - Normalized lowercase hostname.
 */
function requireGitIdentity(host: string): GitIdentity {
  const existing = getGitIdentity(host);
  if (existing) {
    return existing;
  }
  return upsertGitIdentity(host, { auth: { kind: 'pat', username: 'token' } });
}

/**
 * Resolves the GitHub OAuth App client id for a host identity.
 *
 * @param host - Normalized lowercase hostname.
 */
function resolveGitHubOAuthClientId(host: string): string {
  return getGitIdentity(host)?.oauthClientId?.trim() || GITHUB_OAUTH_CLIENT_ID;
}

/**
 * In-flight OAuth refresh promises keyed by host.
 *
 * GitHub rotates refresh tokens on use; concurrent refreshes with the same
 * token cause `invalid_grant` and break the session. Callers share one refresh.
 */
const refreshPromises = new Map<string, Promise<string>>();

/**
 * Returns a fresh OAuth access token for a host, refreshing when expired when possible.
 *
 * @param host - Normalized lowercase hostname.
 */
async function resolveOAuthAccessToken(host: string): Promise<string> {
  const expiresAt = getGitTokenExpiresAt(host);
  const accessToken = getGitAccessToken(host);
  const refreshToken = getGitRefreshToken(host);

  const isExpired = expiresAt != null && Date.now() >= new Date(expiresAt).getTime() - 60_000;

  if (accessToken && !isExpired) {
    return accessToken;
  }

  if (refreshToken) {
    let promise = refreshPromises.get(host);
    if (!promise) {
      promise = refreshGitHubAccessToken(refreshToken, resolveGitHubOAuthClientId(host))
        .then((refreshed) => {
          storeGitOAuthTokens(
            host,
            refreshed.accessToken,
            refreshed.refreshToken,
            refreshed.expiresAt
          );
          return refreshed.accessToken;
        })
        .finally(() => {
          refreshPromises.delete(host);
        });
      refreshPromises.set(host, promise);
    }
    return promise;
  }

  if (accessToken) {
    return accessToken;
  }

  throw new Error('GitHub authorization required. Authorize or enter a token.');
}

/**
 * Resolves HTTPS credentials for a git host based on its stored identity.
 *
 * @param host - Normalized lowercase hostname.
 */
export async function resolveGitAuthForHost(host: string): Promise<ResolvedGitAuth> {
  const identity = requireGitIdentity(host);
  const auth: GitAuthMethod = identity.auth;

  if (auth.kind === 'pat') {
    const token = getGitAccessToken(host);
    if (!token) {
      throw new Error('Personal access token required. Enter a token in Settings.');
    }
    return {
      username: auth.username.trim() || 'token',
      password: token
    };
  }

  const token = await resolveOAuthAccessToken(host);
  return {
    username: 'oauth2',
    password: token
  };
}

/**
 * Resolves HTTPS credentials for a git connection based on its remote host.
 *
 * @param connectionId - Git connection id.
 */
export async function resolveGitAuth(connectionId: string): Promise<ResolvedGitAuth> {
  const host = resolveConnectionHost(connectionId);
  return resolveGitAuthForHost(host);
}

/**
 * Stores a PAT for a git host and updates identity metadata.
 *
 * @param host - Normalized lowercase hostname.
 * @param username - Basic Auth username.
 * @param token - Personal access token.
 */
export async function saveHostPat(host: string, username: string, token: string): Promise<void> {
  storeGitPat(host, token.trim());
  persistGitIdentityAuth(host, {
    kind: 'pat',
    username: username.trim() || 'token'
  });
  await refreshStoredGitHubLogin(host);
}

/**
 * Stores a PAT for a git connection by resolving its host.
 *
 * @param connectionId - Git connection id.
 * @param username - Basic Auth username.
 * @param token - Personal access token.
 */
export async function saveGitPat(
  connectionId: string,
  username: string,
  token: string
): Promise<void> {
  const host = resolveConnectionHost(connectionId);
  await saveHostPat(host, username, token);
}

/**
 * Starts GitHub device flow for a git host.
 *
 * @param host - Normalized lowercase hostname.
 */
export async function beginHostGitHubOAuth(host: string): Promise<{
  userCode: string;
  verificationUri: string;
}> {
  return startGitHubDeviceFlow(host, resolveGitHubOAuthClientId(host));
}

/**
 * Starts GitHub device flow for a git connection's host.
 *
 * @param connectionId - Git connection id.
 */
export async function beginGitHubOAuth(connectionId: string): Promise<{
  userCode: string;
  verificationUri: string;
}> {
  const conn = requireGitConnection(connectionId);
  if (!isGitHubRepositoryUrl(conn.settings.url)) {
    throw new Error('GitHub OAuth is only supported for github.com repository URLs.');
  }
  const host = requireGitHost(conn.settings.url);
  return beginHostGitHubOAuth(host);
}

/**
 * Starts GitHub device flow for a host after validating the test URL is on GitHub.
 *
 * @param host - Normalized lowercase hostname.
 * @param testUrl - Repository URL used to confirm GitHub OAuth is supported.
 */
export async function beginHostGitHubOAuthForUrl(
  host: string,
  testUrl: string
): Promise<{
  userCode: string;
  verificationUri: string;
}> {
  if (!isGitHubRepositoryUrl(testUrl)) {
    throw new Error('GitHub OAuth is only supported for github.com repository URLs.');
  }
  return beginHostGitHubOAuth(host);
}

/**
 * Options for completing GitHub device flow.
 */
export interface FinishGitHubOAuthOptions {
  /**
   * When aborted, token polling stops without storing credentials.
   */
  signal?: AbortSignal;
}

/**
 * Completes GitHub device flow and stores tokens for a git host.
 *
 * @param host - Normalized lowercase hostname.
 * @param options - Optional abort signal for background cancellation.
 */
export async function finishHostGitHubOAuth(
  host: string,
  options: FinishGitHubOAuthOptions = {}
): Promise<void> {
  const tokens = await completeGitHubDeviceFlow(host, options);
  storeGitOAuthTokens(host, tokens.accessToken, tokens.refreshToken, tokens.expiresAt);
  persistGitIdentityAuth(host, { kind: 'oauth', provider: 'github' });
  await refreshStoredGitHubLogin(host, tokens.accessToken);
}

/**
 * Completes GitHub device flow for a git connection's host.
 *
 * @param connectionId - Git connection id.
 * @param options - Optional abort signal for background cancellation.
 */
export async function finishGitHubOAuth(
  connectionId: string,
  options: FinishGitHubOAuthOptions = {}
): Promise<void> {
  const host = resolveConnectionHost(connectionId);
  await finishHostGitHubOAuth(host, options);
}

/**
 * Removes stored credentials and identity metadata for a git host.
 *
 * @param host - Normalized lowercase hostname.
 */
export function revokeHost(host: string): void {
  deleteGitSecrets(host);
  deleteGitIdentity(host);
}

/**
 * Removes stored GitHub OAuth tokens for a git connection's host.
 *
 * @param connectionId - Git connection id.
 */
export function revokeGitHubOAuth(connectionId: string): void {
  const host = resolveConnectionHost(connectionId);
  deleteGitSecrets(host);
  persistGitIdentityAuth(host, { kind: 'pat', username: 'token' });
}

/**
 * Updates the OAuth client id override for a host identity.
 *
 * @param host - Normalized lowercase hostname.
 * @param oauthClientId - OAuth App client id, or empty to clear.
 */
export function saveHostOAuthClientId(host: string, oauthClientId: string): void {
  setGitIdentityOAuthClientId(host, oauthClientId);
}

/**
 * Returns whether a host has stored credentials and identity metadata.
 *
 * @param host - Normalized lowercase hostname.
 */
export function isHostAuthorized(host: string): boolean {
  const identity = getGitIdentity(host);
  if (!identity || !hasGitAccessToken(host)) {
    return false;
  }
  return identity.auth.kind === 'oauth' || identity.auth.kind === 'pat';
}

/**
 * Re-exports identity listing for IPC handlers.
 */
export { listGitIdentities };

/**
 * Lists git host identities, refreshing missing GitHub logins when credentials exist.
 */
export async function listGitIdentitiesWithLogins(): Promise<GitIdentity[]> {
  const identities = listGitIdentities();
  for (const identity of identities) {
    if (identity.host === 'github.com' && identity.hasCredentials && !identity.githubLogin) {
      await refreshStoredGitHubLogin(identity.host);
    }
  }
  return listGitIdentities();
}

/**
 * Fetches the GitHub login for a user access token.
 *
 * @param accessToken - PAT or OAuth access token.
 * @returns GitHub username when the API call succeeds.
 */
async function fetchGithubLogin(accessToken: string): Promise<string | undefined> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${accessToken}`,
      'X-GitHub-Api-Version': '2026-03-10'
    }
  });

  if (!response.ok) {
    return undefined;
  }

  const data = (await response.json()) as { login?: string };
  return typeof data.login === 'string' ? data.login : undefined;
}

/**
 * Resolves the GitHub username for a host's stored credentials.
 *
 * @param host - Normalized lowercase hostname.
 * @returns GitHub login when the host is github.com and the token is valid.
 */
export async function resolveGitHubLogin(host: string): Promise<string | null> {
  if (host !== 'github.com') {
    return null;
  }

  const cached = getGitIdentity(host)?.githubLogin?.trim();
  if (cached) {
    return cached;
  }

  const token = getGitAccessToken(host);
  if (!token) {
    return null;
  }

  const login = await fetchGithubLogin(token);
  return login ?? null;
}

/**
 * Fetches and caches the GitHub login for a host after credentials change.
 *
 * @param host - Normalized lowercase hostname.
 * @param accessToken - Optional token to use instead of reading from storage.
 */
async function refreshStoredGitHubLogin(host: string, accessToken?: string): Promise<void> {
  if (host !== 'github.com') {
    return;
  }

  const token = accessToken ?? getGitAccessToken(host);
  if (!token) {
    persistGitIdentityLogin(host, undefined);
    return;
  }

  const login = await fetchGithubLogin(token);
  persistGitIdentityLogin(host, login);
}

/**
 * Validates git credentials for a host by probing the remote (no local repo required).
 *
 * For GitHub URLs, uses the REST repos API so empty remotes and push permission
 * are detected correctly. Other hosts list server refs.
 *
 * @param host - Normalized lowercase hostname.
 * @param testUrl - HTTPS remote URL to probe.
 * @param branch - Expected branch name when the remote has refs (defaults to `main`).
 * @returns Validation outcome including empty-remote and optional push capability.
 */
export async function testHostCredentials(
  host: string,
  testUrl: string,
  branch = 'main'
): Promise<GitRemoteValidationResult> {
  const githubLogin = getGitIdentity(host)?.githubLogin ?? null;
  return validateRemoteCredentials(testUrl, branch, () => resolveGitAuthForHost(host), {
    githubLogin
  });
}

/**
 * Builds an isomorphic-git onAuth callback for a git connection.
 *
 * @param connectionId - Git connection id.
 */
export function buildGitOnAuth(connectionId: string): () => Promise<ResolvedGitAuth> {
  return async () => resolveGitAuth(connectionId);
}
