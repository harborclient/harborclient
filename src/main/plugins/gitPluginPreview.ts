import {
  buildGitHubRawContentUrl,
  parseGitHubRepo,
  relativePathFromRawGitHubUrl
} from '#/shared/plugin/githubRaw';
import { assertSafeGitPluginUrl } from './gitPluginUrl';
import { parsePluginManifest } from './manifestSchema';
import type { PluginGitPreview, PluginScreenshot } from '#/shared/plugin/types';

const MANIFEST_FILENAME = 'manifest.json';
const DEFAULT_REF = 'main';
const SCREENSHOT_FALLBACK = 'screenshot.png';

/**
 * Returns the repository-relative path from a manifest screenshot entry.
 *
 * @param screenshot - Manifest screenshot string or object.
 */
function screenshotRelativePath(screenshot: PluginScreenshot): string {
  return typeof screenshot === 'string' ? screenshot : screenshot.path;
}

/**
 * Returns true when a manifest screenshot entry is an absolute HTTP(S) URL.
 *
 * @param screenshot - Manifest screenshot string or object.
 */
function isAbsoluteScreenshotUrl(screenshot: PluginScreenshot): boolean {
  const value = typeof screenshot === 'string' ? screenshot : screenshot.path;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Returns a MIME type guess for plugin asset paths.
 *
 * @param filePath - Plugin-relative asset path.
 */
function mimeTypeForPath(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.md')) return 'text/markdown';
  if (lower.endsWith('.css')) return 'text/css';
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
 * Absolute URLs pass through unchanged. Repository-relative paths are fetched
 * from GitHub raw content. When the manifest declares no screenshots, falls
 * back to `screenshot.png` at the repository root.
 *
 * @param repoUrl - Public GitHub repository URL.
 * @param ref - Branch, tag, or commit ref.
 * @param screenshots - Optional manifest screenshot entries.
 * @returns Resolved screenshot sources in manifest order.
 */
async function resolveManifestScreenshotSrcs(
  repoUrl: string,
  ref: string,
  screenshots: PluginScreenshot[] | undefined
): Promise<string[]> {
  if (!screenshots?.length) {
    const fallback = await fetchScreenshotFromPaths(repoUrl, ref, [SCREENSHOT_FALLBACK]);
    return fallback ? [fallback] : [];
  }

  const resolved: string[] = [];

  for (const screenshot of screenshots) {
    const value = screenshotRelativePath(screenshot);
    const relativeFromRaw = relativePathFromRawGitHubUrl(value);

    if (relativeFromRaw) {
      const dataUrl = await fetchScreenshotFromPaths(repoUrl, ref, [relativeFromRaw]);
      if (dataUrl) {
        resolved.push(dataUrl);
      }
      continue;
    }

    if (isAbsoluteScreenshotUrl(screenshot)) {
      resolved.push(value);
      continue;
    }

    const dataUrl = await fetchScreenshotFromPaths(repoUrl, ref, [value]);
    if (dataUrl) {
      resolved.push(dataUrl);
    }
  }

  return resolved;
}

/**
 * Fetches manifest.json and related preview assets from a public GitHub repository.
 *
 * Engine compatibility is not enforced so marketplace browsing works before upgrade.
 *
 * @param url - Public https (or http) repository URL.
 * @param ref - Optional branch or tag; defaults to `main`.
 * @returns Parsed manifest plus optional description markdown and screenshot data URLs.
 * @throws When the URL is invalid, not GitHub-hosted, or manifest.json cannot be loaded.
 */
export async function fetchPluginPreviewFromGit(
  url: string,
  ref?: string
): Promise<PluginGitPreview> {
  const normalizedUrl = assertSafeGitPluginUrl(url);
  if (!parseGitHubRepo(normalizedUrl)) {
    throw new Error('Plugin preview is only supported for public GitHub repositories.');
  }

  const resolvedRef = ref?.trim() || DEFAULT_REF;
  const manifestUrl = buildGitHubRawContentUrl(normalizedUrl, resolvedRef, MANIFEST_FILENAME);
  if (!manifestUrl) {
    throw new Error('Could not resolve manifest URL for the repository.');
  }

  const manifestText = await fetchText(manifestUrl);
  if (!manifestText) {
    throw new Error('Could not fetch manifest.json from the repository.');
  }

  let manifest;
  try {
    manifest = parsePluginManifest(JSON.parse(manifestText) as unknown);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid manifest.json.';
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
    manifest,
    descriptionMarkdown,
    screenshotSrcs: screenshotSrcs.length > 0 ? screenshotSrcs : undefined
  };
}
