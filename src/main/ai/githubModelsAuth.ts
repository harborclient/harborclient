import type { GithubModelsStatus } from '#/shared/types/ai';
import {
  clearPendingGitHubDeviceFlow,
  completeGitHubDeviceFlow,
  GITHUB_MODELS_APP_CLIENT_ID,
  refreshGitHubAccessToken,
  startGitHubDeviceFlow
} from '#/main/git/githubOAuth';
import {
  deleteGithubModelsAuth,
  getGithubModelsAccessToken,
  getGithubModelsLogin,
  getGithubModelsRefreshToken,
  getGithubModelsTokenExpiresAt,
  hasGithubModelsAccessToken,
  storeGithubModelsTokens
} from '#/main/ai/githubModelsSecrets';

/**
 * Stable device-flow key for GitHub Models sign-in.
 */
export const GITHUB_MODELS_FLOW_KEY = 'github-models';

const TOKEN_EXPIRY_BUFFER_MS = 60_000;

/**
 * Options for completing GitHub Models device flow.
 */
export interface FinishGithubModelsSignInOptions {
  /**
   * When aborted, token polling stops without storing credentials.
   */
  signal?: AbortSignal;
}

/**
 * In-flight OAuth refresh promise for GitHub Models.
 *
 * GitHub rotates refresh tokens on use; concurrent refreshes with the same
 * token cause `invalid_grant` and break the session.
 */
let refreshPromise: Promise<string> | undefined;

/**
 * Fetches the GitHub login for a user access token.
 *
 * @param accessToken - OAuth access token with at least read:user scope or equivalent App permission.
 */
async function fetchGithubLogin(accessToken: string): Promise<string | undefined> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
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
 * Starts GitHub Models device flow.
 *
 * @returns User code and verification URI for browser approval.
 */
export async function beginGithubModelsSignIn(): Promise<{
  userCode: string;
  verificationUri: string;
}> {
  return startGitHubDeviceFlow(GITHUB_MODELS_FLOW_KEY, GITHUB_MODELS_APP_CLIENT_ID, undefined);
}

/**
 * Completes GitHub Models device flow and stores tokens.
 *
 * @param options - Optional abort signal for background cancellation.
 */
export async function finishGithubModelsSignIn(
  options: FinishGithubModelsSignInOptions = {}
): Promise<void> {
  const tokens = await completeGitHubDeviceFlow(GITHUB_MODELS_FLOW_KEY, options);
  const login = await fetchGithubLogin(tokens.accessToken);
  storeGithubModelsTokens(tokens.accessToken, tokens.refreshToken, tokens.expiresAt, login);
}

/**
 * Returns a valid GitHub Models access token, refreshing when expired when possible.
 *
 * @returns OAuth access token with models:read permission.
 * @throws When no token is stored or refresh fails.
 */
export async function getValidGithubModelsAccessToken(): Promise<string> {
  const expiresAt = getGithubModelsTokenExpiresAt();
  const accessToken = getGithubModelsAccessToken();
  const refreshToken = getGithubModelsRefreshToken();

  const isExpired =
    expiresAt != null && Date.now() >= new Date(expiresAt).getTime() - TOKEN_EXPIRY_BUFFER_MS;

  if (accessToken && !isExpired) {
    return accessToken;
  }

  if (refreshToken) {
    if (!refreshPromise) {
      refreshPromise = refreshGitHubAccessToken(refreshToken, GITHUB_MODELS_APP_CLIENT_ID)
        .then(async (refreshed) => {
          const login = getGithubModelsLogin() ?? (await fetchGithubLogin(refreshed.accessToken));
          storeGithubModelsTokens(
            refreshed.accessToken,
            refreshed.refreshToken,
            refreshed.expiresAt,
            login
          );
          return refreshed.accessToken;
        })
        .finally(() => {
          refreshPromise = undefined;
        });
    }
    return refreshPromise;
  }

  if (accessToken) {
    return accessToken;
  }

  throw new Error('GitHub Models is not connected. Sign in with GitHub in Settings → AI & MCP.');
}

/**
 * Returns GitHub Models connection status for the renderer.
 */
export function getGithubModelsStatus(): GithubModelsStatus {
  return {
    connected: hasGithubModelsAccessToken(),
    login: getGithubModelsLogin(),
    expiresAt: getGithubModelsTokenExpiresAt()
  };
}

/**
 * Removes stored GitHub Models credentials and cancels any pending device flow.
 */
export function signOutGithubModels(): void {
  clearPendingGitHubDeviceFlow(GITHUB_MODELS_FLOW_KEY);
  deleteGithubModelsAuth();
}
