/**
 * Parses owner and repository name from a public GitHub repository URL.
 *
 * @param repoUrl - HTTPS GitHub repository URL, optionally ending in `.git`.
 * @returns Owner and repo slug when the URL targets github.com.
 */
export function parseGitHubRepo(repoUrl: string): { owner: string; repo: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(repoUrl.trim());
  } catch {
    return null;
  }

  if (parsed.hostname !== 'github.com') {
    return null;
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  const owner = segments[0];
  const repo = segments[1]?.replace(/\.git$/, '');
  if (!owner || !repo) {
    return null;
  }

  return { owner, repo };
}

/**
 * Builds a raw.githubusercontent.com URL for a file in a public GitHub repository.
 *
 * @param repoUrl - HTTPS GitHub repository URL.
 * @param ref - Branch, tag, or commit ref.
 * @param relativePath - Repository-relative file path.
 * @returns Raw content URL, or null when the repository URL is not GitHub-hosted.
 */
export function buildGitHubRawContentUrl(
  repoUrl: string,
  ref: string,
  relativePath: string
): string | null {
  const repo = parseGitHubRepo(repoUrl);
  if (!repo) {
    return null;
  }

  const normalizedPath = relativePath.replace(/^\/+/, '');
  if (!normalizedPath || normalizedPath.includes('..')) {
    return null;
  }

  return `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${ref}/${normalizedPath}`;
}

/**
 * Returns true when a screenshot value is an absolute HTTP(S) URL.
 *
 * @param value - Screenshot string from a catalog entry or manifest.
 * @returns True when the value parses as an http or https URL.
 */
function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Extracts a repository-relative path from a raw.githubusercontent.com URL.
 *
 * @param value - Absolute screenshot URL.
 * @returns Relative path when the URL is a GitHub raw content URL, otherwise null.
 */
export function relativePathFromRawGitHubUrl(value: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return null;
  }

  if (parsed.hostname !== 'raw.githubusercontent.com') {
    return null;
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  // /{owner}/{repo}/{ref}/{path...}
  if (segments.length < 4) {
    return null;
  }

  const relativePath = segments.slice(3).join('/');
  if (!relativePath || relativePath.includes('..')) {
    return null;
  }

  return relativePath;
}

/**
 * Resolves a catalog or manifest screenshot value to a displayable URL.
 *
 * Repository-relative paths resolve against the listing's GitHub repo and ref.
 * Absolute raw.githubusercontent.com URLs are reduced to their repository-relative
 * path first so stale owner/repo/ref segments in manifests do not 404. Other
 * absolute HTTP(S) URLs pass through unchanged.
 *
 * @param value - Absolute URL or repository-relative path (e.g. `screenshot.png`).
 * @param repoUrl - HTTPS GitHub repository URL for the listing.
 * @param ref - Optional branch, tag, or commit; defaults to `main`.
 * @returns Resolved screenshot URL, or null when a relative path cannot be built.
 */
export function resolveScreenshotUrl(value: string, repoUrl: string, ref?: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const relativeFromRaw = relativePathFromRawGitHubUrl(trimmed);
  if (relativeFromRaw && repoUrl) {
    return buildGitHubRawContentUrl(repoUrl, ref?.trim() || 'main', relativeFromRaw);
  }

  if (isAbsoluteHttpUrl(trimmed)) {
    return trimmed;
  }

  return buildGitHubRawContentUrl(repoUrl, ref?.trim() || 'main', trimmed);
}

/**
 * Resolves catalog screenshot fields into displayable image URLs.
 *
 * Prefers the plural `screenshots` array when present, otherwise falls back to
 * the singular `screenshot`. Relative paths are resolved against `repoUrl`/`ref`.
 *
 * @param repoUrl - HTTPS GitHub repository URL for the listing.
 * @param ref - Optional branch, tag, or commit for relative paths.
 * @param screenshots - Optional plural screenshot values from the catalog entry.
 * @param screenshot - Optional singular screenshot value from the catalog entry.
 * @returns Resolved screenshot URLs suitable for `<img src>`.
 */
export function resolveCatalogScreenshotUrls(
  repoUrl: string,
  ref: string | undefined,
  screenshots?: string[],
  screenshot?: string
): string[] {
  const values = screenshots?.length ? screenshots : screenshot ? [screenshot] : [];
  const resolved: string[] = [];

  for (const value of values) {
    const url = resolveScreenshotUrl(value, repoUrl, ref);
    if (url) {
      resolved.push(url);
    }
  }

  return resolved;
}
