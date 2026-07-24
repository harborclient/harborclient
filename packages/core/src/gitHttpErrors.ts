/**
 * Git remote HTTP operations that can surface isomorphic-git HttpError failures.
 */
export type GitHttpOperation = 'fetch' | 'push' | 'pull' | 'validate';

/**
 * Optional context for richer GitHub access-denied messages.
 */
export interface GitHttpErrorContext {
  /**
   * GitHub username HarborClient is authenticated as, when known.
   */
  githubLogin?: string | null;

  /**
   * Repository owner from the remote URL (user or org login), for SSO hints.
   */
  owner?: string | null;
}

const IPC_ERROR_PREFIX = /^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/i;

/**
 * Strips Electron IPC invoke wrapper text from an error message.
 *
 * @param message - Raw error message from a renderer IPC call.
 * @returns User-facing message without the internal invoke prefix.
 */
export function stripIpcInvokeErrorPrefix(message: string): string {
  return message.replace(IPC_ERROR_PREFIX, '').trim();
}

/**
 * Returns whether an error indicates GitHub (or another host) reported the
 * repository as missing.
 *
 * GitHub often returns 404 for private repos when credentials cannot access
 * them, even when the repository exists for a different account.
 *
 * @param err - Thrown value from isomorphic-git or a string message.
 */
export function isGitRepoNotFoundError(err: unknown): boolean {
  if (err == null) {
    return false;
  }

  if (typeof err === 'object') {
    const record = err as { code?: string; data?: { statusCode?: number }; message?: string };
    if (record.data?.statusCode === 404) {
      return true;
    }
    if (typeof record.message === 'string' && matchesRepoNotFoundMessage(record.message)) {
      return true;
    }
  }

  if (typeof err === 'string') {
    return matchesRepoNotFoundMessage(err);
  }

  return false;
}

/**
 * Returns whether a message string looks like a 404 / repository-not-found response.
 *
 * @param message - Error message text.
 */
function matchesRepoNotFoundMessage(message: string): boolean {
  return (
    /\b404\b/i.test(message) || /repository not found/i.test(message) || /not found/i.test(message)
  );
}

/**
 * Extracts an optional owner login stuck on a thrown error object.
 *
 * @param err - Error that may carry an `owner` field from the REST probe.
 */
function ownerFromError(err: unknown): string | undefined {
  if (err != null && typeof err === 'object' && 'owner' in err) {
    const owner = (err as { owner?: unknown }).owner;
    return typeof owner === 'string' && owner.trim() ? owner.trim() : undefined;
  }
  return undefined;
}

/**
 * Formats a git remote HTTP error into an actionable user-facing message.
 *
 * For 404 / "not found" responses, explains that GitHub may be hiding access
 * denied behind a missing-repo status and includes the signed-in account and
 * org SSO link when context is available. Other errors keep their original message.
 *
 * @param err - Thrown value from isomorphic-git or related validation.
 * @param operation - Remote operation that failed (shown in the message).
 * @param context - Optional signed-in login and repository owner for diagnostics.
 * @returns User-facing error string suitable for toasts and form alerts.
 */
export function formatGitHttpError(
  err: unknown,
  operation: GitHttpOperation,
  context: GitHttpErrorContext = {}
): string {
  if (isGitRepoNotFoundError(err)) {
    return githubRepoNotFoundMessage(operation, {
      githubLogin: context.githubLogin,
      owner: context.owner ?? ownerFromError(err)
    });
  }

  if (err instanceof Error) {
    return stripIpcInvokeErrorPrefix(err.message);
  }

  if (typeof err === 'string') {
    return stripIpcInvokeErrorPrefix(err);
  }

  return String(err);
}

/**
 * Builds a diagnostic "repository not found" message with account and SSO hints.
 *
 * @param operation - Remote operation label, or null to omit the operation clause.
 * @param context - Signed-in login and repository owner when known.
 */
export function githubRepoNotFoundMessage(
  operation: GitHttpOperation | null,
  context: GitHttpErrorContext = {}
): string {
  const operationClause = operation != null ? ` during ${operation}` : '';
  const login = context.githubLogin?.trim();
  const owner = context.owner?.trim();

  const parts: string[] = [`GitHub returned "repository not found"${operationClause}.`];

  if (login) {
    parts.push(`HarborClient is signed in as ${login}.`);
  } else {
    parts.push(
      'The URL may be wrong, or your saved HarborClient credentials (Settings → Git) ' +
        'may not have access to this repo.'
    );
  }

  parts.push(
    'The repo may not exist, or this account may lack access — wrong GitHub account, ' +
      'missing org SSO approval, or insufficient token scope.'
  );

  if (owner) {
    parts.push(
      `If ${owner} is an organization that requires SSO, approve access at ` +
        `https://github.com/orgs/${owner}/sso then re-authorize in HarborClient.`
    );
  } else {
    parts.push(
      'Re-authorize for github.com and confirm you can open the repo in the browser ' +
        'while logged in as the account HarborClient is using.'
    );
  }

  return parts.join(' ');
}

/**
 * Builds a diagnostic message when GitHub requires SAML SSO authorization (403).
 *
 * @param operation - Remote operation label, or null to omit the operation clause.
 * @param context - Signed-in login and repository owner when known.
 * @param ssoUrl - SSO authorization URL from the `x-github-sso` header, when present.
 */
export function githubSsoRequiredMessage(
  operation: GitHttpOperation | null,
  context: GitHttpErrorContext = {},
  ssoUrl?: string | null
): string {
  const operationClause = operation != null ? ` during ${operation}` : '';
  const login = context.githubLogin?.trim();
  const owner = context.owner?.trim();
  const url = ssoUrl?.trim() || (owner ? `https://github.com/orgs/${owner}/sso` : null);

  const parts: string[] = [
    `GitHub denied access${operationClause} because SAML SSO authorization is required.`
  ];

  if (login) {
    parts.push(`HarborClient is signed in as ${login}.`);
  }

  if (url) {
    parts.push(`Authorize this credential for the organization at ${url}, then try again.`);
  } else {
    parts.push(
      'Authorize this credential for the organization in GitHub (Settings → Applications ' +
        'or the org SSO page), then try again.'
    );
  }

  return parts.join(' ');
}

/**
 * Builds a diagnostic message when GitHub rate-limits the request (403/429).
 *
 * @param operation - Remote operation label, or null to omit the operation clause.
 * @param retryAfterSeconds - Seconds to wait from a `retry-after` header, when present.
 */
export function githubRateLimitMessage(
  operation: GitHttpOperation | null,
  retryAfterSeconds?: number | null
): string {
  const operationClause = operation != null ? ` during ${operation}` : '';
  const wait =
    retryAfterSeconds != null && retryAfterSeconds > 0
      ? ` Wait about ${retryAfterSeconds} seconds and try again.`
      : ' Wait a few minutes and try again.';
  return `GitHub rate limit reached${operationClause}.${wait}`;
}

/**
 * Returns whether a GitHub API error message indicates org OAuth App access restrictions.
 *
 * @param message - Raw `message` field from a GitHub REST error body.
 */
export function isGitHubOAuthAppRestrictionMessage(message: string): boolean {
  return /OAuth App access restrictions/i.test(message);
}

/**
 * Extracts an organization login from GitHub's OAuth-restriction error text when present.
 *
 * GitHub's message typically includes backtick-quoted org names, e.g.
 * `the \`harborclient\` organization has enabled OAuth App access restrictions`.
 *
 * @param message - Raw GitHub REST error `message` field.
 * @returns Organization login when found, otherwise null.
 */
export function ownerFromOAuthAppRestrictionMessage(message: string): string | null {
  const match = message.match(/`([A-Za-z0-9-]+)`\s+organization/i);
  return match?.[1]?.trim() || null;
}

/**
 * Builds a diagnostic message when an org blocks the OAuth App (403).
 *
 * @param operation - Remote operation label, or null to omit the operation clause.
 * @param context - Signed-in login and repository owner when known.
 */
export function githubOAuthAppRestrictionMessage(
  operation: GitHttpOperation | null,
  context: GitHttpErrorContext = {}
): string {
  const operationClause = operation != null ? ` during ${operation}` : '';
  const login = context.githubLogin?.trim();
  const owner = context.owner?.trim();

  const parts: string[] = [
    `GitHub denied access${operationClause} because the ${
      owner ? `${owner} organization` : 'organization'
    } restricts third-party OAuth apps.`
  ];

  if (login) {
    parts.push(`HarborClient is signed in as ${login}.`);
  }

  parts.push(
    'Re-authorize in HarborClient, click Finish authentication, and grant access to that ' +
      "organization on GitHub's approval screen. If you already granted it, ask an org admin " +
      'to approve HarborClient under Organization → Settings → Third-party access.'
  );

  return parts.join(' ');
}

/**
 * Builds a diagnostic message for a generic GitHub 403 (insufficient permissions/scope).
 *
 * @param operation - Remote operation label, or null to omit the operation clause.
 * @param context - Signed-in login and repository owner when known.
 */
export function githubForbiddenMessage(
  operation: GitHttpOperation | null,
  context: GitHttpErrorContext = {}
): string {
  const operationClause = operation != null ? ` during ${operation}` : '';
  const login = context.githubLogin?.trim();

  const parts: string[] = [`GitHub denied access${operationClause} (403 Forbidden).`];

  if (login) {
    parts.push(`HarborClient is signed in as ${login}.`);
  }

  parts.push(
    'The account may lack access to this repository, or the token scope is insufficient — ' +
      'wrong GitHub account, missing org approval during OAuth, missing org SSO approval, ' +
      'or a token without repo access. Re-authorize for github.com with sufficient scope and try again.'
  );

  return parts.join(' ');
}

/**
 * Builds a user-facing message when credentials were saved but repo validation failed.
 *
 * Prefer the main-process diagnostic message when it already includes account or SSO
 * guidance; otherwise fall back to a generic 404 explanation.
 *
 * @param validationError - Raw or already-formatted validation error from the main process.
 */
export function credentialsSavedValidationMessage(validationError: string): string {
  if (
    validationError.includes('HarborClient is signed in') ||
    validationError.includes('github.com/orgs/') ||
    validationError.includes('did not grant push access') ||
    validationError.includes('SAML SSO authorization is required') ||
    validationError.includes('rate limit reached') ||
    validationError.includes('restricts third-party OAuth apps')
  ) {
    return validationError.startsWith('Credentials saved')
      ? validationError
      : `Credentials saved, but ${validationError.charAt(0).toLowerCase()}${validationError.slice(1)}`;
  }

  if (isGitRepoNotFoundError(validationError)) {
    return (
      'Credentials saved, but GitHub returned "repository not found". ' +
      'The URL may be wrong, or these credentials may not have access to this repo — ' +
      'wrong GitHub account, missing org SSO approval, or insufficient token scope. ' +
      'Confirm the URL and that you can open the repo in the browser while logged in as ' +
      'the account HarborClient is using.'
    );
  }
  return `Credentials saved, but the repository could not be verified. ${validationError}`;
}

/**
 * Builds a warning when credentials can read a repository but cannot push.
 */
export function readOnlyRepoAccessMessage(): string {
  return (
    'Credentials can read this repository, but GitHub did not grant push access. ' +
    'Push and initial commits will fail until you re-authorize with sufficient scope ' +
    'or get write access to the repo.'
  );
}

/**
 * Builds a non-error status message when credentials reach an empty remote repository.
 */
export function emptyRemoteCredentialsMessage(): string {
  return (
    'Credentials verified. The remote repository is empty — initialize locally and push ' +
    'your first commit to create the branch.'
  );
}

/**
 * Builds a success message for the Test connection button when the remote is empty.
 */
export function emptyRemoteConnectionTestMessage(): string {
  return (
    'Connection successful. Remote repository is empty; initialize locally and push your ' +
    'first commit.'
  );
}

/**
 * Builds a success message for the Test connection button when the remote has the branch.
 */
export function successfulConnectionTestMessage(): string {
  return 'Connection successful. Credentials can reach this repository.';
}
