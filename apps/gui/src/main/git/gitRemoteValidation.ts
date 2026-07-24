import * as git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import {
  formatGitHttpError,
  githubRepoNotFoundMessage,
  isGitRepoNotFoundError,
  readOnlyRepoAccessMessage
} from '#/shared/gitHttpErrors';
import { isGitHubRepositoryUrl } from '#/shared/gitUrl';
import { parseGitHubRepo } from '#/shared/plugin/githubRaw';
import { probeGitHubRepoAccess } from './githubRepoAccess';
import type { ResolvedGitAuth } from './gitAuth';

/**
 * Outcome of validating git credentials against a remote URL.
 */
export interface GitRemoteValidationResult {
  /**
   * True when the remote is reachable but has no branch refs yet (empty repo).
   */
  emptyRemote: boolean;

  /**
   * True when the remote grants push access; false when read-only; undefined when unknown.
   */
  canPush?: boolean;
}

/**
 * Optional diagnostics context for GitHub-hosted validation.
 */
export interface ValidateRemoteCredentialsOptions {
  /**
   * GitHub username HarborClient is authenticated as, when known.
   */
  githubLogin?: string | null;
}

/**
 * Returns whether a server ref name matches the configured branch.
 *
 * Accepts bare branch names (`main`) and full heads refs (`refs/heads/main`).
 *
 * @param refName - Ref name from {@link git.listServerRefs}.
 * @param branch - Configured branch name (without `refs/heads/` prefix).
 */
function refMatchesBranch(refName: string, branch: string): boolean {
  const trimmed = branch.trim();
  if (!trimmed) {
    return false;
  }
  return refName === trimmed || refName === `refs/heads/${trimmed}`;
}

/**
 * Builds a user-facing error when credentials work but the configured branch is absent.
 *
 * @param branch - Configured branch name that was not found on the remote.
 */
export function missingRemoteBranchMessage(branch: string): string {
  const trimmed = branch.trim() || 'main';
  return (
    `Credentials verified, but branch "${trimmed}" does not exist on the remote. ` +
    'Check the branch name or push an initial commit that creates it.'
  );
}

/**
 * Validates credentials for a GitHub-hosted remote via the REST repos API.
 *
 * Preferring the REST API over listServerRefs avoids false "repository not found"
 * failures on empty remotes and surfaces push vs read-only permissions.
 *
 * @param remoteUrl - HTTPS GitHub repository URL.
 * @param accessToken - PAT or OAuth access token.
 * @param githubLogin - Signed-in GitHub username when known.
 * @returns Validation outcome including empty-remote and push capability.
 * @throws When the repository is not visible to the token or the token is invalid.
 */
async function validateGitHubRemoteCredentials(
  remoteUrl: string,
  accessToken: string,
  githubLogin?: string | null
): Promise<GitRemoteValidationResult> {
  const owner = parseGitHubRepo(remoteUrl)?.owner ?? null;

  try {
    const access = await probeGitHubRepoAccess(remoteUrl, accessToken);
    if (!access) {
      throw new Error(githubRepoNotFoundMessage('validate', { githubLogin, owner }));
    }

    return {
      emptyRemote: access.emptyRemote,
      canPush: access.canPush
    };
  } catch (err) {
    if (isGitRepoNotFoundError(err)) {
      throw new Error(
        githubRepoNotFoundMessage('validate', {
          githubLogin,
          owner: ownerFromThrown(err) ?? owner
        })
      );
    }
    throw err instanceof Error ? err : new Error(String(err));
  }
}

/**
 * Reads an optional owner login from a thrown REST probe error.
 *
 * @param err - Error that may carry an `owner` field.
 */
function ownerFromThrown(err: unknown): string | undefined {
  if (err != null && typeof err === 'object' && 'owner' in err) {
    const value = (err as { owner?: unknown }).owner;
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
  return undefined;
}

/**
 * Validates that credentials can reach a git remote.
 *
 * For github.com URLs, uses the GitHub REST API (works on empty remotes and
 * reports push permission). For other hosts, lists server refs without requiring
 * the configured branch to exist when the remote is empty.
 *
 * @param remoteUrl - HTTPS remote URL to probe.
 * @param branch - Expected branch name when the remote has refs (non-GitHub only).
 * @param onAuth - Callback that returns Basic Auth credentials for the host.
 * @param options - Optional GitHub login for diagnostic error messages.
 * @returns Validation outcome, including empty-remote and optional push capability.
 * @throws When the remote is unreachable, auth fails, or the branch is missing on a non-empty remote.
 */
export async function validateRemoteCredentials(
  remoteUrl: string,
  branch: string,
  onAuth: () => Promise<ResolvedGitAuth>,
  options: ValidateRemoteCredentialsOptions = {}
): Promise<GitRemoteValidationResult> {
  const trimmedUrl = remoteUrl.trim();
  const auth = await onAuth();

  if (isGitHubRepositoryUrl(trimmedUrl)) {
    return validateGitHubRemoteCredentials(trimmedUrl, auth.password, options.githubLogin);
  }

  let refs: Awaited<ReturnType<typeof git.listServerRefs>>;
  try {
    refs = await git.listServerRefs({
      http,
      url: trimmedUrl,
      onAuth: async () => auth
    });
  } catch (err) {
    throw new Error(formatGitHttpError(err, 'validate'));
  }

  if (refs.length === 0) {
    return { emptyRemote: true };
  }

  const trimmedBranch = branch.trim() || 'main';
  const hasBranch = refs.some((ref) => refMatchesBranch(ref.ref, trimmedBranch));
  if (!hasBranch) {
    throw new Error(missingRemoteBranchMessage(trimmedBranch));
  }

  return { emptyRemote: false };
}

/**
 * Returns a user-facing warning when validation succeeded without push access.
 *
 * @param result - Outcome from {@link validateRemoteCredentials}.
 * @returns Warning text, or null when push access is available or unknown.
 */
export function readOnlyAccessWarning(result: GitRemoteValidationResult): string | null {
  if (result.canPush === false) {
    return readOnlyRepoAccessMessage();
  }
  return null;
}
