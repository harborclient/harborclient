import { buildGitHubRawContentUrl, parseGitHubRepo } from '#/shared/plugin/githubRaw';
import { assertSafeGitPluginUrl } from '#/main/plugins/gitPluginUrl';
import { parseSnippetManifest } from './manifestSchema';
import type { SnippetGitPreview } from '#/shared/snippet/types';

const MANIFEST_FILENAME = 'snippets.json';
const DEFAULT_REF = 'main';
const SCREENSHOT_FALLBACK = 'screenshot.png';

type ManifestScreenshot = string | { path: string; caption?: string };

/**
 * Returns the repository-relative path from a manifest screenshot entry.
 *
 * @param screenshot - Manifest screenshot string or object.
 */
function screenshotRelativePath(screenshot: ManifestScreenshot): string {
  return typeof screenshot === 'string' ? screenshot : screenshot.path;
}

/**
 * Returns true when a manifest screenshot entry is an absolute HTTP(S) URL.
 *
 * @param screenshot - Manifest screenshot string or object.
 */
function isAbsoluteScreenshotUrl(screenshot: ManifestScreenshot): boolean {
  const value = typeof screenshot === 'string' ? screenshot : screenshot.path;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Returns a MIME type guess for snippet asset paths.
 *
 * @param filePath - Repository-relative asset path.
 */
function mimeTypeForPath(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.md')) return 'text/markdown';
  if (lower.endsWith('.js')) return 'text/javascript';
  return 'application/octet-stream';
}

/**
 * Fetches UTF-8 text from a remote URL.
 *
 * @param url - Absolute HTTP(S) URL.
 * @returns Response body when the request succeeds.
 */
async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return await response.text();
  } catch {
    return null;
  }
}

/**
 * Fetches a binary asset and returns a data URL suitable for `<img src>`.
 *
 * @param url - Absolute HTTP(S) URL.
 * @param filePath - Repository-relative path used for MIME type detection.
 * @returns Data URL when the request succeeds.
 */
async function fetchBinaryAsDataUrl(url: string, filePath: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const mimeType = mimeTypeForPath(filePath);
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * Attempts to load a screenshot from one or more repository-relative paths.
 *
 * @param repoUrl - Public GitHub repository URL.
 * @param ref - Branch, tag, or commit ref.
 * @param paths - Candidate screenshot paths in priority order.
 * @returns Data URL for the first path that resolves successfully.
 */
async function fetchScreenshotFromPaths(
  repoUrl: string,
  ref: string,
  paths: string[]
): Promise<string | undefined> {
  for (const relativePath of paths) {
    const rawUrl = buildGitHubRawContentUrl(repoUrl, ref, relativePath);
    if (!rawUrl) {
      continue;
    }
    const dataUrl = await fetchBinaryAsDataUrl(rawUrl, relativePath);
    if (dataUrl) {
      return dataUrl;
    }
  }
  return undefined;
}

/**
 * Resolves every manifest screenshot entry to a displayable URL or data URL.
 *
 * @param repoUrl - Public GitHub repository URL.
 * @param ref - Branch, tag, or commit ref.
 * @param screenshots - Optional manifest screenshot entries.
 * @returns Resolved screenshot sources in manifest order.
 */
async function resolveManifestScreenshotSrcs(
  repoUrl: string,
  ref: string,
  screenshots: ManifestScreenshot[] | undefined
): Promise<string[]> {
  if (!screenshots?.length) {
    const fallback = await fetchScreenshotFromPaths(repoUrl, ref, [SCREENSHOT_FALLBACK]);
    return fallback ? [fallback] : [];
  }

  const resolved: string[] = [];

  for (const screenshot of screenshots) {
    if (isAbsoluteScreenshotUrl(screenshot)) {
      resolved.push(screenshotRelativePath(screenshot));
      continue;
    }

    const relativePath = screenshotRelativePath(screenshot);
    const dataUrl = await fetchScreenshotFromPaths(repoUrl, ref, [relativePath]);
    if (dataUrl) {
      resolved.push(dataUrl);
    }
  }

  return resolved;
}

/**
 * Fetches snippets.json and related preview assets from a public GitHub repository.
 *
 * Engine compatibility is not enforced so marketplace browsing works before upgrade.
 *
 * @param url - Public https (or http) repository URL.
 * @param ref - Optional branch or tag; defaults to `main`.
 * @returns Parsed bundle preview for the marketplace detail modal.
 * @throws When the URL is invalid, not GitHub-hosted, or snippets.json cannot be loaded.
 */
export async function fetchSnippetPreviewFromGit(
  url: string,
  ref?: string
): Promise<SnippetGitPreview> {
  const normalizedUrl = assertSafeGitPluginUrl(url);
  if (!parseGitHubRepo(normalizedUrl)) {
    throw new Error('Snippet preview is only supported for public GitHub repositories.');
  }

  const resolvedRef = ref?.trim() || DEFAULT_REF;
  const manifestUrl = buildGitHubRawContentUrl(normalizedUrl, resolvedRef, MANIFEST_FILENAME);
  if (!manifestUrl) {
    throw new Error('Could not resolve snippets.json URL for the repository.');
  }

  const manifestText = await fetchText(manifestUrl);
  if (!manifestText) {
    throw new Error('Could not fetch snippets.json from the repository.');
  }

  let manifest;
  try {
    manifest = parseSnippetManifest(JSON.parse(manifestText) as unknown);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid snippets.json.';
    throw new Error(message);
  }

  let descriptionMarkdown: string | undefined;
  if (manifest.description) {
    const descriptionUrl = buildGitHubRawContentUrl(
      normalizedUrl,
      resolvedRef,
      manifest.description
    );
    if (descriptionUrl) {
      const text = await fetchText(descriptionUrl);
      if (text) {
        descriptionMarkdown = text;
      }
    }
  }

  const screenshotSrcs = await resolveManifestScreenshotSrcs(
    normalizedUrl,
    resolvedRef,
    manifest.screenshots
  );

  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    summary: manifest.summary ?? manifest.name,
    author: manifest.author,
    descriptionMarkdown,
    screenshotSrcs,
    snippets: manifest.snippets.map((entry) => ({
      name: entry.name,
      phase: entry.phase,
      stage: entry['stage'],
      file: entry.file,
      uuid: entry.uuid
    }))
  };
}
