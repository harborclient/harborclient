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

/**
 * Normalizes a git remote URL to HTTPS when possible.
 *
 * Converts scp-style (`git@host:org/repo.git`) and `ssh://` remotes to HTTPS so
 * HarborClient can use token or OAuth auth. Already-HTTPS (or HTTP) URLs are
 * returned unchanged; unrecognized formats are returned as trimmed input.
 *
 * @param url - Git remote URL from a local repository config.
 * @returns HTTPS URL when the input is a known SSH or HTTP(S) remote format.
 */
export function normalizeGitRemoteToHttps(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('ssh://')) {
    try {
      const parsed = new URL(trimmed);
      const path = parsed.pathname.replace(/^\//, '');
      return `https://${parsed.hostname}/${path}`;
    } catch {
      return trimmed;
    }
  }

  const scpMatch = trimmed.match(/^[^@]+@([^:]+):(.+)$/);
  if (scpMatch) {
    const [, host, path] = scpMatch;
    return `https://${host}/${path}`;
  }

  return trimmed;
}
