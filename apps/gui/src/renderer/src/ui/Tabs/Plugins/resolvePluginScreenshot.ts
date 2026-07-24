import type { PluginCatalogEntry } from '#/shared/plugin/catalog';
import type { PluginGitPreview, PluginInfo } from '#/shared/plugin/types';
import {
  relativePathFromRawGitHubUrl,
  resolveCatalogScreenshotUrls,
  resolveScreenshotUrl
} from '#/shared/plugin/githubRaw';

/**
 * Returns the repository-relative path from a manifest screenshot entry.
 *
 * @param screenshot - Manifest screenshot string or object.
 */
function screenshotRelativePath(
  screenshot: NonNullable<PluginInfo['manifest']['screenshots']>[number]
): string {
  return typeof screenshot === 'string' ? screenshot : screenshot.path;
}

/**
 * Returns true when a manifest screenshot entry is an absolute HTTP(S) URL.
 *
 * @param screenshot - Manifest screenshot string or object.
 */
function isAbsoluteScreenshotUrl(
  screenshot: NonNullable<PluginInfo['manifest']['screenshots']>[number]
): boolean {
  const value = typeof screenshot === 'string' ? screenshot : screenshot.path;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Returns a repository-relative asset path when the screenshot can be read from disk.
 *
 * @param value - Manifest screenshot string.
 * @returns Relative path for `readPluginAsset`, or null for non-local absolute URLs.
 */
function manifestScreenshotDiskPath(value: string): string | null {
  const relativeFromRaw = relativePathFromRawGitHubUrl(value);
  if (relativeFromRaw) {
    return relativeFromRaw;
  }

  if (isAbsoluteScreenshotUrl(value)) {
    return null;
  }

  return value;
}

/**
 * Builds a data URL from a plugin asset read over IPC.
 *
 * @param asset - Base64 asset payload from the main process.
 * @returns Data URL suitable for `<img src>`.
 */
export function pluginAssetToDataUrl(asset: { content: string; mimeType: string }): string {
  return `data:${asset.mimeType};base64,${asset.content}`;
}

/**
 * Loads the best available screenshots for an installed plugin.
 *
 * Manifest assets on disk take priority, then resolved manifest/catalog URLs,
 * then a GitHub raw fallback for `screenshot.png`.
 *
 * @param plugin - Installed plugin row.
 * @param catalogScreenshots - Optional marketplace screenshot URLs for this plugin id.
 * @param catalogScreenshot - Optional singular marketplace screenshot URL.
 * @returns Resolved screenshot URLs/data URLs in manifest order when available.
 */
export async function loadInstalledPluginScreenshotSrcs(
  plugin: PluginInfo,
  catalogScreenshots?: string[],
  catalogScreenshot?: string
): Promise<string[]> {
  const manifestScreenshots = plugin.manifest.screenshots;
  if (manifestScreenshots?.length) {
    const resolved: string[] = [];

    for (const manifestScreenshot of manifestScreenshots) {
      const value = screenshotRelativePath(manifestScreenshot);
      const diskPath = manifestScreenshotDiskPath(value);

      if (diskPath) {
        try {
          const asset = await window.api.readPluginAsset(plugin.id, diskPath);
          resolved.push(pluginAssetToDataUrl(asset));
          continue;
        } catch {
          // Fall through to URL resolution below.
        }
      }

      const repoUrl = plugin.repoUrl;
      if (repoUrl) {
        const url = resolveScreenshotUrl(value, repoUrl, plugin.repoRef);
        if (url) {
          resolved.push(url);
          continue;
        }
      }

      if (isAbsoluteScreenshotUrl(value)) {
        resolved.push(value);
      }
    }

    if (resolved.length > 0) {
      return resolved;
    }
  }

  if (plugin.repoUrl) {
    const catalogUrls = resolveCatalogScreenshotUrls(
      plugin.repoUrl,
      plugin.repoRef,
      catalogScreenshots,
      catalogScreenshot
    );
    if (catalogUrls.length > 0) {
      return catalogUrls;
    }
  } else {
    const catalogUrls = catalogScreenshots?.length
      ? catalogScreenshots
      : catalogScreenshot
        ? [catalogScreenshot]
        : [];
    if (catalogUrls.length > 0) {
      return catalogUrls;
    }
  }

  const repoUrl = plugin.repoUrl;
  const ref = plugin.repoRef ?? 'main';
  if (repoUrl) {
    const fallback = resolveScreenshotUrl('screenshot.png', repoUrl, ref);
    return fallback ? [fallback] : [];
  }

  return [];
}

/**
 * Resolves the screenshots shown in a marketplace preview modal.
 *
 * @param entry - Marketplace listing.
 * @param preview - Remote preview payload when manifest fetch succeeded.
 * @returns Screenshot URLs/data URLs in priority order.
 */
export function resolveCatalogPluginScreenshotSrcs(
  entry: PluginCatalogEntry,
  preview: PluginGitPreview | null
): string[] {
  if (preview?.screenshotSrcs?.length) {
    return preview.screenshotSrcs;
  }

  return resolveCatalogScreenshotUrls(
    entry.repoUrl,
    entry.ref,
    entry.screenshots,
    entry.screenshot
  );
}
