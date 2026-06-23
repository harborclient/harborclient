import {
  completeGitHubDeviceFlow,
  GITHUB_OAUTH_CLIENT_ID,
  refreshGitHubAccessToken,
  startGitHubDeviceFlow
} from '#/main/git/githubOAuth';
import {
  deleteGitSecrets,
  getGitAccessToken,
  getGitRefreshToken,
  getGitTokenExpiresAt,
  storeGitOAuthTokens,
  storeGitPat
} from '#/main/git/gitSecrets';
import type { DatabaseConnection, GitAuthMethod } from '#/shared/types';
import { isGitHubRepositoryUrl } from '#/shared/gitUrl';
import { listDatabaseConnections, saveDatabaseConnection } from '#/main/settings/databaseSettings';

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
function requireGitConnection(connectionId: string): DatabaseConnection & { type: 'git' } {
  const conn = listDatabaseConnections().find((item) => item.id === connectionId);
  if (!conn || conn.type !== 'git') {
    throw new Error(`Git connection not found: ${connectionId}`);
  }
  return conn;
}

/**
 * Resolves the GitHub OAuth App client id for a git connection.
 *
 * @param conn - Git connection configuration.
 */
function resolveGitHubOAuthClientId(conn: DatabaseConnection & { type: 'git' }): string {
  return conn.settings.oauthClientId?.trim() || GITHUB_OAUTH_CLIENT_ID;
}

/**
 * In-flight OAuth refresh promises keyed by connection id.
 *
 * GitHub rotates refresh tokens on use; concurrent refreshes with the same
 * token cause `invalid_grant` and break the session. Callers share one refresh.
 */
const refreshPromises = new Map<string, Promise<string>>();

/**
 * Returns a fresh OAuth access token, refreshing when expired when possible.
 *
 * @param connectionId - Git connection id.
 */
async function resolveOAuthAccessToken(connectionId: string): Promise<string> {
  const expiresAt = getGitTokenExpiresAt(connectionId);
  const accessToken = getGitAccessToken(connectionId);
  const refreshToken = getGitRefreshToken(connectionId);

  const isExpired = expiresAt != null && Date.now() >= new Date(expiresAt).getTime() - 60_000;

  if (accessToken && !isExpired) {
    return accessToken;
  }

  if (refreshToken) {
    let promise = refreshPromises.get(connectionId);
    if (!promise) {
      const conn = requireGitConnection(connectionId);
      promise = refreshGitHubAccessToken(refreshToken, resolveGitHubOAuthClientId(conn))
        .then((refreshed) => {
          storeGitOAuthTokens(
            connectionId,
            refreshed.accessToken,
            refreshed.refreshToken,
            refreshed.expiresAt
          );
          return refreshed.accessToken;
        })
        .finally(() => {
          refreshPromises.delete(connectionId);
        });
      refreshPromises.set(connectionId, promise);
    }
    return promise;
  }

  if (accessToken) {
    return accessToken;
  }

  throw new Error('GitHub authorization required. Authorize or enter a token.');
}

/**
 * Resolves HTTPS credentials for a git connection based on its auth method.
 *
 * @param connectionId - Git connection id.
 */
export async function resolveGitAuth(connectionId: string): Promise<ResolvedGitAuth> {
  const conn = requireGitConnection(connectionId);
  const auth: GitAuthMethod = conn.settings.auth;

  if (auth.kind === 'pat') {
    const token = getGitAccessToken(connectionId);
    if (!token) {
      throw new Error('Personal access token required. Enter a token in Settings.');
    }
    return {
      username: auth.username.trim() || 'token',
      password: token
    };
  }

  const token = await resolveOAuthAccessToken(connectionId);
  return {
    username: 'oauth2',
    password: token
  };
}

/**
 * Updates persisted git connection auth metadata after credential changes.
 *
 * @param connectionId - Git connection id.
 * @param auth - New auth method metadata.
 */
export function persistGitAuthMetadata(
  connectionId: string,
  auth: { kind: 'pat'; username: string } | { kind: 'oauth'; provider: 'github' }
): void {
  const connections = listDatabaseConnections();
  const index = connections.findIndex((conn) => conn.id === connectionId);
  if (index < 0 || connections[index].type !== 'git') {
    throw new Error(`Git connection not found: ${connectionId}`);
  }
  const conn = connections[index];
  if (conn.type !== 'git') {
    return;
  }
  conn.settings.auth = auth;
  saveDatabaseConnection(conn);
}

/**
 * Stores a PAT for a git connection and updates auth metadata.
 *
 * @param connectionId - Git connection id.
 * @param username - Basic Auth username.
 * @param token - Personal access token.
 */
export function saveGitPat(connectionId: string, username: string, token: string): void {
  storeGitPat(connectionId, token.trim());
  persistGitAuthMetadata(connectionId, {
    kind: 'pat',
    username: username.trim() || 'token'
  });
}

/**
 * Starts GitHub device flow for a git connection.
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
  return startGitHubDeviceFlow(connectionId, resolveGitHubOAuthClientId(conn));
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
 * Completes GitHub device flow and stores tokens for a git connection.
 *
 * @param connectionId - Git connection id.
 * @param options - Optional abort signal for background cancellation.
 */
export async function finishGitHubOAuth(
  connectionId: string,
  options: FinishGitHubOAuthOptions = {}
): Promise<void> {
  const tokens = await completeGitHubDeviceFlow(connectionId, options);
  storeGitOAuthTokens(connectionId, tokens.accessToken, tokens.refreshToken, tokens.expiresAt);
  persistGitAuthMetadata(connectionId, { kind: 'oauth', provider: 'github' });
}

/**
 * Removes stored GitHub OAuth tokens and resets auth metadata to the default PAT shape.
 *
 * @param connectionId - Git connection id.
 */
export function revokeGitHubOAuth(connectionId: string): void {
  deleteGitSecrets(connectionId);
  persistGitAuthMetadata(connectionId, { kind: 'pat', username: 'token' });
}

/**
 * Builds an isomorphic-git onAuth callback for a git connection.
 *
 * @param connectionId - Git connection id.
 */
export function buildGitOnAuth(connectionId: string): () => Promise<ResolvedGitAuth> {
  return async () => resolveGitAuth(connectionId);
}
