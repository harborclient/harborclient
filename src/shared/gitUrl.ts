/**
 * Extracts the hostname from an HTTPS git remote URL string.
 *
 * Accepts absolute URLs and host/path values without a scheme (for example
 * `github.com/org/repo.git`).
 *
 * @param url - Git remote URL or host/path fragment.
 * @returns Parsed hostname when the value is parseable, otherwise null.
 */
export function gitRemoteHostname(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).hostname || null;
  } catch {
    try {
      return new URL(`https://${trimmed}`).hostname || null;
    } catch {
      return null;
    }
  }
}

/**
 * Returns whether a git remote URL points at github.com.
 *
 * Uses exact hostname matching so lookalike domains such as `notgithub.com` or
 * `github.com.evil.test` are not treated as GitHub.
 *
 * @param url - Git remote URL or host/path fragment.
 * @returns True when the parsed hostname is exactly `github.com`.
 */
export function isGitHubRepositoryUrl(url: string): boolean {
  const hostname = gitRemoteHostname(url);
  return hostname?.toLowerCase() === 'github.com';
}
