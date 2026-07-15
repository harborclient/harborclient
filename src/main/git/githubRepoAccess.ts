import {
  githubForbiddenMessage,
  githubOAuthAppRestrictionMessage,
  githubRateLimitMessage,
  githubSsoRequiredMessage,
  isGitHubOAuthAppRestrictionMessage,
  ownerFromOAuthAppRestrictionMessage
} from '#/shared/gitHttpErrors';
import { parseGitHubRepo } from '#/shared/plugin/githubRaw';

/**
 * Outcome of probing a GitHub repository via the REST API.
 */
export interface GitHubRepoAccessResult {
  /**
   * Repository owner (user or organization login).
   */
  owner: string;

  /**
   * Repository name without `.git`.
   */
  repo: string;

  /**
   * True when the authenticated token can push to the repository.
   */
  canPush: boolean;

  /**
   * True when the authenticated token can pull from the repository.
   */
  canPull: boolean;

  /**
   * True when GitHub reports the repository has no content (`size === 0`).
   */
  emptyRemote: boolean;

  /**
   * Default branch name when set, or null for empty repositories.
   */
  defaultBranch: string | null;
}

/**
 * Builds standard GitHub REST API request headers for a user access token.
 *
 * @param accessToken - PAT or OAuth access token.
 */
function githubApiHeaders(accessToken: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${accessToken}`,
    'X-GitHub-Api-Version': '2026-03-10'
  };
}

/**
 * Parses the SSO authorization URL from a GitHub `x-github-sso` response header.
 *
 * The header looks like `required; url=https://github.com/orgs/ORG/sso?...`.
 *
 * @param headerValue - Raw `x-github-sso` header value, or null when absent.
 * @returns The authorization URL when present, otherwise null.
 */
function parseSsoAuthorizationUrl(headerValue: string | null): string | null {
  if (!headerValue) {
    return null;
  }
  const match = headerValue.match(/url=([^;,\s]+)/i);
  return match?.[1]?.trim() || null;
}

/**
 * Parses a non-negative integer from a `retry-after` header value.
 *
 * @param headerValue - Raw `retry-after` header value, or null when absent.
 * @returns Seconds to wait when the header is a positive integer, otherwise null.
 */
function parseRetryAfterSeconds(headerValue: string | null): number | null {
  if (!headerValue) {
    return null;
  }
  const seconds = Number.parseInt(headerValue, 10);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

/**
 * Reads a JSON error body from a GitHub REST failure response.
 *
 * @param response - Non-OK response from the GitHub REST API.
 * @returns Parsed JSON object, or null when the body is missing or not JSON.
 */
async function readGitHubErrorBody(response: Response): Promise<{ message?: string } | null> {
  try {
    return (await response.json()) as { message?: string };
  } catch {
    return null;
  }
}

/**
 * Builds a diagnostic error for a GitHub 403/429, distinguishing SSO, rate limits,
 * OAuth App org restrictions, and generic permission failures.
 *
 * @param response - The 403 or 429 response from the GitHub REST API.
 * @param owner - Repository owner login used for org hints.
 * @returns An Error with an actionable, context-aware message.
 */
async function forbiddenError(response: Response, owner: string): Promise<Error> {
  const ssoUrl = parseSsoAuthorizationUrl(response.headers.get('x-github-sso'));
  if (ssoUrl || response.headers.get('x-github-sso')) {
    return new Error(githubSsoRequiredMessage('validate', { owner }, ssoUrl));
  }

  const retryAfter = parseRetryAfterSeconds(response.headers.get('retry-after'));
  const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
  if (retryAfter != null || rateLimitRemaining === '0') {
    return new Error(githubRateLimitMessage('validate', retryAfter));
  }

  const body = await readGitHubErrorBody(response);
  const apiMessage = typeof body?.message === 'string' ? body.message : '';
  if (apiMessage && isGitHubOAuthAppRestrictionMessage(apiMessage)) {
    const messageOwner = ownerFromOAuthAppRestrictionMessage(apiMessage) ?? owner;
    return new Error(githubOAuthAppRestrictionMessage('validate', { owner: messageOwner }));
  }

  return new Error(githubForbiddenMessage('validate', { owner }));
}

/**
 * Probes GitHub REST API for repository existence and token permissions.
 *
 * Returns null when the URL is not a github.com repository URL. Throws with a
 * status-aware, diagnostic message when the API rejects the request
 * (401 re-auth, 403 SSO/rate-limit/scope, 404 not-found).
 *
 * @param repoUrl - HTTPS GitHub repository URL.
 * @param accessToken - PAT or OAuth access token for Authorization.
 * @returns Access details when the repository is visible to the token.
 * @throws When the API returns an error status or the response is invalid.
 */
export async function probeGitHubRepoAccess(
  repoUrl: string,
  accessToken: string
): Promise<GitHubRepoAccessResult | null> {
  const parsed = parseGitHubRepo(repoUrl);
  if (!parsed) {
    return null;
  }

  const { owner, repo } = parsed;
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: githubApiHeaders(accessToken)
  });

  if (response.status === 401) {
    throw new Error(
      'GitHub authorization expired or is invalid. Re-authorize for github.com in Settings → Git.'
    );
  }

  if (response.status === 403 || response.status === 429) {
    throw await forbiddenError(response, owner);
  }

  if (response.status === 404) {
    const notFound = Object.assign(new Error('HTTP Error: 404 Not Found'), {
      code: 'HttpError',
      data: { statusCode: 404 },
      owner
    });
    throw notFound;
  }

  if (!response.ok) {
    throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    size?: number;
    default_branch?: string | null;
    permissions?: { push?: boolean; pull?: boolean };
  };

  const canPush = data.permissions?.push === true;
  const canPull = data.permissions?.pull === true || canPush;
  const emptyRemote = typeof data.size === 'number' ? data.size === 0 : false;
  const defaultBranch =
    typeof data.default_branch === 'string' && data.default_branch.trim()
      ? data.default_branch.trim()
      : null;

  return {
    owner,
    repo,
    canPush,
    canPull,
    emptyRemote,
    defaultBranch
  };
}
